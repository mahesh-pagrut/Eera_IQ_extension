import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONVERSATION_SESSION_STATES,
  createConversationSessionManager,
} from './conversationSessionManager.js';
import { createConversationEngine } from './conversation/conversationEngine.js';
import { createMessageRouter } from './conversation/messageRouter.js';

function createClock() {
  let time = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    now: () => time,
    setTimeout(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, due: time + delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    async advance(milliseconds) {
      const end = time + milliseconds;
      while (true) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.due <= end)
          .sort((a, b) => a[1].due - b[1].due)[0];
        if (!due) break;
        const [id, timer] = due;
        timers.delete(id);
        time = timer.due;
        timer.callback();
        await flushPromises();
      }
      time = end;
      await flushPromises();
    },
    count: () => timers.size,
  };
}

async function flushPromises() {
  for (let turn = 0; turn < 10; turn += 1) {
    await Promise.resolve();
  }
}

function createRecognition() {
  const transcripts = new Set();
  const errors = new Set();
  let status = 'idle';
  return {
    startCount: 0,
    stopCount: 0,
    language: 'en-IN',
    startListening() {
      if (['starting', 'listening', 'processing', 'stopping'].includes(status)) {
        return false;
      }
      this.startCount += 1;
      status = 'listening';
      return true;
    },
    async stopListening() {
      if (status !== 'idle') this.stopCount += 1;
      status = 'idle';
    },
    getStatus: () => status,
    setLanguage(language) {
      this.language = language;
    },
    onTranscript(callback) {
      transcripts.add(callback);
      return () => transcripts.delete(callback);
    },
    onError(callback) {
      errors.add(callback);
      return () => errors.delete(callback);
    },
    emitTranscript(text, isFinal = true) {
      for (const listener of transcripts) listener({ text, isFinal });
    },
    emitError(error) {
      status = 'error';
      for (const listener of errors) listener(error);
    },
  };
}

function createLease({ acquired = true } = {}) {
  const lostListeners = new Set();
  return {
    acquireCount: 0,
    releaseCount: 0,
    disposeCount: 0,
    async acquire() {
      this.acquireCount += 1;
      return acquired;
    },
    release() {
      this.releaseCount += 1;
    },
    dispose() {
      this.disposeCount += 1;
    },
    onLost(listener) {
      lostListeners.add(listener);
      return () => lostListeners.delete(listener);
    },
  };
}

function createHarness(options = {}) {
  const clock = createClock();
  const recognition = options.recognition ?? createRecognition();
  const lease = options.microphoneLease ?? createLease();
  const requests = [];
  const states = [];
  const errors = [];
  const manager = createConversationSessionManager({
    recognition,
    microphoneLease: lease,
    onRequest: async (text) => {
      requests.push(text);
      return { speechStarted: options.speechStarted ?? true };
    },
    onStateChange: (state) => states.push(state),
    onError: (error) => errors.push(error),
    followUpWindowMs: options.followUpWindowMs ?? 12_000,
    inactivityTimeoutMs: options.inactivityTimeoutMs ?? 60 * 60 * 1_000,
    maxRecoveryAttempts: options.maxRecoveryAttempts ?? 3,
    recoveryDelaysMs: options.recoveryDelaysMs ?? [500, 1_500, 3_000],
    now: clock.now,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
  });
  return { clock, recognition, lease, requests, states, errors, manager };
}

test('ordinary speech in wake standby is never routed as a request', async () => {
  const harness = createHarness();
  await harness.manager.activate();
  harness.recognition.emitTranscript('open YouTube');
  await flushPromises();
  assert.deepEqual(harness.requests, []);
  assert.equal(
    harness.manager.getState(),
    CONVERSATION_SESSION_STATES.WAKE_WORD_STANDBY,
  );
  await harness.manager.deactivate();
});

test('wake phrase is removed before routing and a request may follow in the same transcript', async () => {
  const harness = createHarness();
  await harness.manager.activate();
  harness.recognition.emitTranscript('Hey, Eera, open YouTube');
  await flushPromises();
  assert.deepEqual(harness.requests, ['open youtube']);
  assert.equal(
    harness.manager.getState(),
    CONVERSATION_SESSION_STATES.PROCESSING,
  );
  await harness.manager.deactivate();
});

test('wake sessions preserve existing command and personality routing', async () => {
  const clock = createClock();
  const recognition = createRecognition();
  const actions = [];
  const routeMessage = createMessageRouter({
    conversationEngine: createConversationEngine(),
    execute: async (command) => {
      actions.push(command.intent);
      return { response: 'Opening YouTube.' };
    },
  });
  const manager = createConversationSessionManager({
    recognition,
    followUpWindowMs: 12_000,
    inactivityTimeoutMs: 60_000,
    now: clock.now,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
    onRequest: async (text) => ({
      ...(await routeMessage(text)),
      speechStarted: false,
    }),
  });

  await manager.activate();
  recognition.emitTranscript('हे एरा, यूट्यूब खोलो');
  await flushPromises();
  assert.deepEqual(actions, ['open-youtube']);
  assert.equal(manager.getState(), CONVERSATION_SESSION_STATES.FOLLOW_UP);

  recognition.emitTranscript('hello');
  await flushPromises();
  assert.deepEqual(actions, ['open-youtube']);
  await manager.deactivate();
});

test('a collapsed wake transcript still routes open YouTube through the command pipeline', async () => {
  const clock = createClock();
  const recognition = createRecognition();
  const actions = [];
  const routeMessage = createMessageRouter({
    conversationEngine: createConversationEngine(),
    execute: async (command) => {
      actions.push(command.intent);
      return { response: 'Opening YouTube.' };
    },
  });
  const manager = createConversationSessionManager({
    recognition,
    followUpWindowMs: 12_000,
    inactivityTimeoutMs: 60_000,
    now: clock.now,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
    onRequest: async (text) => ({
      ...(await routeMessage(text)),
      speechStarted: false,
    }),
  });

  await manager.activate();
  recognition.emitTranscript('Here open YouTube');
  await flushPromises();

  assert.deepEqual(actions, ['open-youtube']);
  assert.equal(manager.getState(), CONVERSATION_SESSION_STATES.FOLLOW_UP);
  await manager.deactivate();
});

test('a collapsed wake word and request may arrive as separate final results', async () => {
  const harness = createHarness();
  await harness.manager.activate();

  harness.recognition.emitTranscript('Here');
  await flushPromises();
  assert.equal(
    harness.manager.getState(),
    CONVERSATION_SESSION_STATES.COMMAND_LISTENING,
  );

  harness.recognition.emitTranscript('open YouTube');
  await flushPromises();
  assert.deepEqual(harness.requests, ['open YouTube']);
  await harness.manager.deactivate();
});

test('wake phrase alone starts command listening; follow-up requests need no wake phrase', async () => {
  const harness = createHarness();
  await harness.manager.activate();
  harness.recognition.emitTranscript('Hey Eera');
  await flushPromises();
  assert.equal(
    harness.manager.getState(),
    CONVERSATION_SESSION_STATES.COMMAND_LISTENING,
  );

  harness.recognition.emitTranscript('what time is it');
  await flushPromises();
  assert.deepEqual(harness.requests, ['what time is it']);

  harness.manager.handleSpeechStatus('speaking');
  harness.manager.handleSpeechStatus('idle');
  assert.equal(
    harness.manager.getState(),
    CONVERSATION_SESSION_STATES.FOLLOW_UP,
  );
  harness.recognition.emitTranscript('open YouTube');
  await flushPromises();
  assert.deepEqual(harness.requests, ['what time is it', 'open YouTube']);
  await harness.manager.deactivate();
});

test('follow-up speech resets the window and timeout returns to wake standby', async () => {
  const harness = createHarness({ followUpWindowMs: 12_000 });
  await harness.manager.activate();
  harness.recognition.emitTranscript('Hey Eera');
  await flushPromises();
  harness.recognition.emitTranscript('hello');
  await flushPromises();
  harness.manager.handleSpeechStatus('speaking');
  harness.manager.handleSpeechStatus('idle');

  await harness.clock.advance(8_000);
  harness.recognition.emitTranscript('tell me', false);
  await harness.clock.advance(11_999);
  assert.equal(
    harness.manager.getState(),
    CONVERSATION_SESSION_STATES.FOLLOW_UP,
  );
  await harness.clock.advance(1);
  assert.ok(
    harness.states.includes(
      CONVERSATION_SESSION_STATES.RETURNING_TO_STANDBY,
    ),
  );
  assert.equal(
    harness.manager.getState(),
    CONVERSATION_SESSION_STATES.WAKE_WORD_STANDBY,
  );
  await harness.manager.deactivate();
});

test('each completed spoken response opens a fresh follow-up window', async () => {
  const harness = createHarness();
  await harness.manager.activate();
  harness.recognition.emitTranscript('Hey Eera');
  await flushPromises();
  harness.recognition.emitTranscript('hello');
  await flushPromises();
  harness.manager.handleSpeechStatus('speaking');
  harness.manager.handleSpeechStatus('idle');
  await harness.clock.advance(11_000);
  harness.recognition.emitTranscript('another request');
  await flushPromises();
  harness.manager.handleSpeechStatus('speaking');
  harness.manager.handleSpeechStatus('idle');
  await harness.clock.advance(11_999);
  assert.equal(
    harness.manager.getState(),
    CONVERSATION_SESSION_STATES.FOLLOW_UP,
  );
  await harness.clock.advance(1);
  assert.equal(
    harness.manager.getState(),
    CONVERSATION_SESSION_STATES.WAKE_WORD_STANDBY,
  );
  await harness.manager.deactivate();
});

test('inactivity timeout deactivates recognition and releases the shared lease', async () => {
  const harness = createHarness({ inactivityTimeoutMs: 60_000 });
  await harness.manager.activate();
  await harness.clock.advance(59_999);
  assert.equal(harness.manager.isActive(), true);
  await harness.clock.advance(1);
  assert.equal(harness.manager.isActive(), false);
  assert.equal(
    harness.manager.getState(),
    CONVERSATION_SESSION_STATES.INACTIVE,
  );
  assert.equal(harness.lease.releaseCount, 1);
  assert.equal(harness.clock.count(), 0);
});

test('recognition recovery is bounded and permission errors stop the session', async () => {
  const harness = createHarness();
  await harness.manager.activate();
  harness.recognition.emitError(Object.assign(new Error('network'), { code: 'network' }));
  await harness.clock.advance(500);
  assert.equal(harness.recognition.startCount, 2);
  harness.recognition.emitError(Object.assign(new Error('denied'), { code: 'not-allowed' }));
  assert.equal(harness.manager.isActive(), false);
  assert.equal(
    harness.manager.getState(),
    CONVERSATION_SESSION_STATES.ERROR,
  );
  assert.equal(harness.lease.releaseCount, 1);
});

test('unexpected recognition failures stop after the configured retry count', async () => {
  const harness = createHarness({ recoveryDelaysMs: [100, 200, 300] });
  await harness.manager.activate();
  for (const [index, delay] of [100, 200, 300].entries()) {
    harness.recognition.emitError(
      Object.assign(new Error('network'), { code: 'network' }),
    );
    await harness.clock.advance(delay);
    assert.equal(harness.recognition.startCount, index + 2);
  }
  harness.recognition.emitError(
    Object.assign(new Error('network'), { code: 'network' }),
  );
  assert.equal(harness.manager.isActive(), false);
  assert.equal(harness.manager.getState(), CONVERSATION_SESSION_STATES.ERROR);
  assert.equal(harness.lease.releaseCount, 1);
  assert.equal(harness.clock.count(), 0);
});

test('unsupported recognition fails activation without scheduling recovery', async () => {
  const harness = createHarness();
  harness.recognition.startListening = () => false;
  harness.recognition.getStatus = () => 'error';
  const activated = await harness.manager.activate();
  assert.equal(activated, false);
  assert.equal(harness.manager.isActive(), false);
  assert.equal(harness.manager.getState(), CONVERSATION_SESSION_STATES.ERROR);
  assert.equal(harness.clock.count(), 0);
});

test('follow-up timeout remains effective while recognition is reconnecting', async () => {
  const harness = createHarness({ followUpWindowMs: 1_000 });
  await harness.manager.activate();
  harness.recognition.emitTranscript('Hey Eera');
  await flushPromises();
  harness.recognition.emitTranscript('hello');
  await flushPromises();
  harness.manager.handleSpeechStatus('speaking');
  harness.manager.handleSpeechStatus('idle');
  harness.recognition.emitError(Object.assign(new Error('network'), { code: 'network' }));
  await harness.clock.advance(500);
  assert.equal(
    harness.manager.getState(),
    CONVERSATION_SESSION_STATES.FOLLOW_UP,
  );
  await harness.clock.advance(500);
  assert.equal(
    harness.manager.getState(),
    CONVERSATION_SESSION_STATES.WAKE_WORD_STANDBY,
  );
  await harness.manager.deactivate();
});

test('duplicate activation shares one microphone lease and one recognition start', async () => {
  let finishAcquire;
  const lease = {
    calls: 0,
    acquire() {
      this.calls += 1;
      return new Promise((resolve) => {
        finishAcquire = resolve;
      });
    },
    release() {},
    onLost() {
      return () => {};
    },
  };
  const recognition = createRecognition();
  const manager = createConversationSessionManager({
    recognition,
    microphoneLease: lease,
    onRequest: async () => ({ speechStarted: false }),
  });
  const first = manager.activate();
  const second = manager.activate();
  assert.equal(lease.calls, 1);
  finishAcquire(true);
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(recognition.startCount, 1);
  await manager.deactivate();
});

test('language changes restart the current recognizer role without opening another session', async () => {
  const harness = createHarness();
  await harness.manager.activate();
  await harness.manager.setLanguage('hi-IN');
  assert.equal(harness.recognition.language, 'hi-IN');
  assert.equal(harness.recognition.startCount, 2);
  assert.equal(
    harness.manager.getState(),
    CONVERSATION_SESSION_STATES.WAKE_WORD_STANDBY,
  );
  await harness.manager.deactivate();
});

test('deactivation and disposal clear session timers and stop recognition', async () => {
  const harness = createHarness();
  await harness.manager.activate();
  harness.manager.dispose();
  await flushPromises();
  assert.equal(harness.clock.count(), 0);
  assert.ok(harness.recognition.stopCount > 0);
  assert.equal(harness.lease.disposeCount, 1);
});
