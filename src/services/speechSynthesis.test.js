import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import {
  createSpeechSynthesisService,
  selectPreferredVoice,
} from './speechSynthesis.js';

class MockSynthesis extends EventEmitter {
  constructor(voices = []) {
    super();
    this.voices = voices;
    this.cancelCount = 0;
    this.utterances = [];
  }

  getVoices() {
    return this.voices;
  }

  addEventListener(type, listener) {
    this.on(type, listener);
  }

  removeEventListener(type, listener) {
    this.off(type, listener);
  }

  speak(utterance) {
    this.utterances.push(utterance);
  }

  cancel() {
    this.cancelCount += 1;
  }
}

class MockUtterance {
  constructor(text) {
    this.text = text;
  }
}

class MockChromePort {
  constructor() {
    this.messages = [];
    this.messageListeners = [];
    this.disconnectListeners = [];
    this.onMessage = {
      addListener: (listener) => this.messageListeners.push(listener),
    };
    this.onDisconnect = {
      addListener: (listener) => this.disconnectListeners.push(listener),
    };
  }

  postMessage(message) {
    this.messages.push(message);
  }

  emit(message) {
    for (const listener of this.messageListeners) listener(message);
  }

  disconnect() {
    for (const listener of this.disconnectListeners) listener();
  }
}

function createService(options = {}) {
  const synthesis = options.synthesis ?? new MockSynthesis();
  const service = createSpeechSynthesisService({
    getSynthesis: () => synthesis,
    getUtterance: () => MockUtterance,
    ...options,
  });
  return { service, synthesis };
}

test('uses the extension TTS bridge and maps Chrome voice and playback events', () => {
  const port = new MockChromePort();
  const runtime = {
    id: 'test-extension',
    connect: () => port,
  };
  const service = createSpeechSynthesisService({
    getRuntime: () => runtime,
  });
  const statuses = [];
  const errors = [];
  const voices = [];
  service.onStatusChange((status) => statuses.push(status));
  service.onError((error) => errors.push(error));
  service.onVoicesChange((items) => voices.push(items));
  assert.equal(port.messages[0].type, 'get-voices');

  port.emit({
    type: 'voices',
    voices: [{ voiceName: 'Hindi Voice', lang: 'hi-IN' }],
  });
  assert.equal(service.getVoices()[0].voiceURI, 'Hindi Voice');
  service.setPreferredVoice('Hindi Voice');
  assert.equal(service.speak('नमस्ते', { language: 'hi-IN' }), true);
  const request = port.messages.at(-1);
  assert.equal(request.type, 'speak');
  assert.equal(request.options.voiceName, 'Hindi Voice');
  port.emit({
    type: 'event',
    requestId: request.requestId,
    event: { type: 'start' },
  });
  assert.equal(service.getStatus(), 'speaking');
  port.emit({
    type: 'event',
    requestId: request.requestId,
    event: { type: 'end' },
  });
  assert.equal(service.getStatus(), 'idle');
  assert.deepEqual(statuses, ['starting', 'speaking', 'idle']);
  assert.equal(voices.at(-1)[0].name, 'Hindi Voice');

  service.speak('Retry');
  const retry = port.messages.at(-1);
  port.emit({
    type: 'event',
    requestId: retry.requestId,
    event: { type: 'error', errorMessage: 'voice unavailable' },
  });
  assert.equal(service.getStatus(), 'error');
  assert.match(errors[0].message, /voice unavailable/);
  service.stopSpeaking();
  assert.equal(port.messages.at(-1).type, 'stop');
  service.dispose();
});

test('uses chrome.tts directly from extension pages when the API is available', () => {
  const port = new MockChromePort();
  const spoken = [];
  const statuses = [];
  const tts = {
    getVoices(callback) {
      callback([{ voiceName: 'English Voice', lang: 'en-IN' }]);
    },
    speak(text, options, callback) {
      spoken.push({ text, options });
      options.onEvent({ type: 'start' });
      callback();
    },
    stop() {},
  };
  const service = createSpeechSynthesisService({
    getRuntime: () => ({ id: 'test-extension', connect: () => port }),
    getTts: () => tts,
  });
  service.onStatusChange((status) => statuses.push(status));
  service.onVoicesChange(() => {});
  assert.equal(port.messages.length, 0);

  assert.equal(service.speak('Hello from the new-tab page'), true);
  assert.equal(spoken[0].text, 'Hello from the new-tab page');
  assert.equal(spoken[0].options.voiceName, 'English Voice');
  assert.deepEqual(statuses, ['starting', 'speaking']);
  service.dispose();
});

test('falls back to browser synthesis if the extension speech receiver disconnects', () => {
  const port = new MockChromePort();
  const synthesis = new MockSynthesis();
  const service = createSpeechSynthesisService({
    getRuntime: () => ({
      id: 'test-extension',
      connect: () => port,
    }),
    getSynthesis: () => synthesis,
    getUtterance: () => MockUtterance,
  });
  const statuses = [];
  service.onStatusChange((status) => statuses.push(status));
  service.onVoicesChange(() => {});
  assert.equal(service.speak('Fallback response'), true);

  port.disconnect();
  assert.equal(synthesis.utterances.length, 1);
  assert.equal(synthesis.utterances[0].text, 'Fallback response');
  synthesis.utterances[0].onstart();
  assert.equal(service.getStatus(), 'speaking');
  assert.deepEqual(statuses, ['starting', 'starting', 'speaking']);
  service.dispose();
});

test('detects native speech synthesis support', () => {
  const { service } = createService();
  assert.equal(service.isSupported(), true);
  assert.equal(
    createSpeechSynthesisService({
      getSynthesis: () => null,
      getUtterance: () => MockUtterance,
    }).isSupported(),
    false,
  );
  service.dispose();
});

test('loads voices initially and refreshes asynchronously on voiceschanged', () => {
  const synthesis = new MockSynthesis();
  const { service } = createService({ synthesis });
  const updates = [];
  service.onVoicesChange((voices) => updates.push(voices));
  assert.deepEqual(updates, [[]]);

  synthesis.voices = [{ name: 'Voice A', lang: 'en-IN', voiceURI: 'voice-a' }];
  synthesis.emit('voiceschanged');

  assert.equal(updates.length, 2);
  assert.equal(service.getVoices()[0].voiceURI, 'voice-a');
  service.dispose();
  assert.equal(synthesis.listenerCount('voiceschanged'), 0);
});

test('prefers a female identifiable voice with a compatible language and falls back', () => {
  const voices = [
    { name: 'Default Hindi', lang: 'hi-IN', voiceURI: 'hi', default: true },
    { name: 'Voice A', lang: 'en-US', voiceURI: 'en-us' },
    { name: 'Female Voice', lang: 'en-IN', voiceURI: 'en-female' },
    { name: 'Male Voice', lang: 'en-IN', voiceURI: 'en-male', gender: 'male' },
    { name: 'Metadata Voice', lang: 'hi-IN', voiceURI: 'hi-female', gender: 'female' },
  ];

  assert.equal(selectPreferredVoice(voices, 'en-IN').voiceURI, 'en-female');
  assert.equal(selectPreferredVoice(voices, 'en-US').voiceURI, 'en-us');
  assert.equal(selectPreferredVoice(voices, 'hi-IN').voiceURI, 'hi-female');
  assert.equal(
    selectPreferredVoice(
      [{ name: 'Browser Default', lang: 'fr-FR', voiceURI: 'default', default: true }],
      'hi-IN',
    ).voiceURI,
    'default',
  );
  assert.equal(selectPreferredVoice([], 'en-IN'), null);
});

test('speaks configured text and reports start and end events', () => {
  const { service, synthesis } = createService({
    synthesis: new MockSynthesis([
      { name: 'Female Voice', lang: 'en-IN', voiceURI: 'female' },
    ]),
  });
  const statuses = [];
  service.onStatusChange((status) => statuses.push(status));

  assert.equal(service.speak('Hello Eera', { language: 'en-IN' }), true);
  const utterance = synthesis.utterances[0];
  assert.equal(utterance.text, 'Hello Eera');
  assert.equal(utterance.lang, 'en-IN');
  assert.equal(utterance.rate, 1);
  assert.equal(utterance.pitch, 1.05);
  assert.equal(utterance.volume, 1);
  assert.equal(utterance.voice.voiceURI, 'female');
  utterance.onstart();
  assert.equal(service.getStatus(), 'speaking');
  utterance.onend();
  assert.equal(service.getStatus(), 'idle');
  assert.deepEqual(statuses, ['starting', 'speaking', 'idle']);
  service.dispose();
});

test('cancels previous speech and ignores its late events', () => {
  const { service, synthesis } = createService();
  const statuses = [];
  service.onStatusChange((status) => statuses.push(status));

  service.speak('First');
  const firstUtterance = synthesis.utterances[0];
  const firstOnStart = firstUtterance.onstart;
  const firstOnEnd = firstUtterance.onend;
  service.speak('Second');
  const secondUtterance = synthesis.utterances[1];
  assert.equal(synthesis.cancelCount, 2);
  assert.equal(firstUtterance.onstart, null);
  assert.equal(firstUtterance.onend, null);

  firstOnStart();
  firstOnEnd();
  assert.equal(service.getStatus(), 'starting');
  secondUtterance.onstart();
  secondUtterance.onend();
  assert.equal(service.getStatus(), 'idle');
  assert.deepEqual(statuses, ['starting', 'starting', 'speaking', 'idle']);
  service.dispose();
});

test('stop immediately cancels speech and emits idle', () => {
  const { service, synthesis } = createService();
  service.speak('Stop me');
  service.stopSpeaking();
  assert.equal(synthesis.cancelCount, 2);
  assert.equal(service.getStatus(), 'idle');
  service.dispose();
});

test('reports synthesis errors and allows a later retry', () => {
  const { service, synthesis } = createService();
  const errors = [];
  service.onError((error) => errors.push(error));

  service.speak('Hello');
  synthesis.utterances[0].onerror({ error: 'voice-unavailable' });
  assert.equal(service.getStatus(), 'error');
  assert.match(errors[0].message, /voice-unavailable/);
  assert.equal(service.speak('Try again'), true);
  assert.equal(service.getStatus(), 'starting');
  service.dispose();
});

test('validates speech configuration and text before applying it', () => {
  const { service } = createService();
  for (const [field, value] of [
    ['rate', 0],
    ['rate', 11],
    ['pitch', -0.1],
    ['pitch', 2.1],
    ['volume', -0.1],
    ['volume', 1.1],
    ['volume', Number.NaN],
    ['language', 'fr-FR'],
  ]) {
    assert.throws(() => service.configure({ [field]: value }));
  }
  assert.throws(() => service.speak('   '), /non-empty/);
  assert.deepEqual(service.getConfiguration(), {
    language: 'en-IN',
    rate: 1,
    pitch: 1.05,
    volume: 1,
  });
  service.dispose();
});

test('uses explicit voice selection and disposes without retaining subscribers', () => {
  const synthesis = new MockSynthesis([
    { name: 'Voice A', lang: 'en-IN', voiceURI: 'a' },
    { name: 'Voice B', lang: 'en-US', voiceURI: 'b' },
  ]);
  const { service } = createService({ synthesis });
  let statusChanges = 0;
  service.onStatusChange(() => {
    statusChanges += 1;
  });
  service.onVoicesChange(() => {});
  service.setPreferredVoice('b');
  service.speak('Voice test');
  assert.equal(synthesis.utterances[0].voice.voiceURI, 'b');
  assert.throws(() => service.setPreferredVoice('missing'), /not available/);

  service.dispose();
  const countAfterDispose = statusChanges;
  assert.equal(synthesis.utterances[0].onstart, null);
  assert.equal(synthesis.utterances[0].onend, null);
  assert.equal(synthesis.utterances[0].onerror, null);
  synthesis.emit('voiceschanged');
  assert.equal(statusChanges, countAfterDispose);
  assert.equal(synthesis.listenerCount('voiceschanged'), 0);
  assert.equal(synthesis.cancelCount, 2);
});

test('reports unsupported speech synthesis when speak is requested', () => {
  const service = createSpeechSynthesisService({
    getSynthesis: () => null,
    getUtterance: () => null,
  });
  assert.equal(service.isSupported(), false);
  assert.throws(() => service.speak('Hello'), /unavailable/);
  service.dispose();
});
