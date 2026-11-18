import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMicrophoneSessionLease,
  createMicrophoneSessionLeaseBroker,
  MICROPHONE_SESSION_PORT,
} from './microphoneSessionLease.js';

function createMockPort(name = MICROPHONE_SESSION_PORT) {
  const messages = new Set();
  const disconnects = new Set();
  return {
    name,
    sent: [],
    onMessage: {
      addListener: (listener) => messages.add(listener),
    },
    onDisconnect: {
      addListener: (listener) => disconnects.add(listener),
    },
    postMessage(message) {
      this.sent.push(message);
    },
    send(message) {
      for (const listener of messages) listener(message);
    },
    disconnect() {
      for (const listener of disconnects) listener();
    },
  };
}

test('broker grants one microphone owner at a time and releases on disconnect', () => {
  const broker = createMicrophoneSessionLeaseBroker();
  const first = createMockPort();
  const second = createMockPort();
  assert.equal(broker.handlePort(first), true);
  assert.equal(broker.handlePort(second), true);

  first.send({ type: 'acquire' });
  assert.deepEqual(first.sent, [{ type: 'granted' }]);
  second.send({ type: 'acquire' });
  assert.deepEqual(second.sent, [{ type: 'denied' }]);

  first.disconnect();
  second.send({ type: 'acquire' });
  assert.deepEqual(second.sent, [{ type: 'denied' }, { type: 'granted' }]);
});

test('broker ignores unrelated extension ports', () => {
  const broker = createMicrophoneSessionLeaseBroker();
  assert.equal(broker.handlePort(createMockPort('eera-tts')), false);
});

test('broker reports a lost owner when a restarted worker has no lease state', () => {
  const broker = createMicrophoneSessionLeaseBroker();
  const port = createMockPort();
  broker.handlePort(port);

  port.send({ type: 'heartbeat' });

  assert.deepEqual(port.sent, [{ type: 'lost' }]);
});

function createPortPair(name) {
  const clientMessages = new Set();
  const serverMessages = new Set();
  const clientDisconnects = new Set();
  const serverDisconnects = new Set();
  const client = {
    name,
    onMessage: { addListener: (listener) => clientMessages.add(listener) },
    onDisconnect: { addListener: (listener) => clientDisconnects.add(listener) },
    postMessage(message) {
      for (const listener of serverMessages) listener(message);
    },
    disconnect() {
      for (const listener of serverDisconnects) listener();
      for (const listener of clientDisconnects) listener();
    },
  };
  const server = {
    name,
    onMessage: { addListener: (listener) => serverMessages.add(listener) },
    onDisconnect: { addListener: (listener) => serverDisconnects.add(listener) },
    postMessage(message) {
      for (const listener of clientMessages) listener(message);
    },
    disconnect() {
      for (const listener of serverDisconnects) listener();
      for (const listener of clientDisconnects) listener();
    },
  };
  return { client, server };
}

test('lease client serializes new-tab and website microphone ownership', async () => {
  const broker = createMicrophoneSessionLeaseBroker();
  const intervals = [];
  const runtime = {
    id: 'eera-test',
    connect({ name }) {
      const { client, server } = createPortPair(name);
      broker.handlePort(server);
      return client;
    },
  };
  const options = {
    getRuntime: () => runtime,
    setIntervalFn: (callback) => {
      intervals.push(callback);
      return intervals.length;
    },
    clearIntervalFn() {},
    setTimeoutFn: () => 1,
    clearTimeoutFn() {},
  };
  const first = createMicrophoneSessionLease(options);
  const second = createMicrophoneSessionLease(options);

  assert.equal(await first.acquire(), true);
  assert.equal(first.isAcquired(), true);
  assert.equal(await second.acquire(), false);
  assert.equal(second.isAcquired(), false);

  intervals[0]();
  first.release();
  assert.equal(await second.acquire(), true);
  second.dispose();
  first.dispose();
});

test('lease client reports an unexpected bridge disconnect to its owner', async () => {
  const broker = createMicrophoneSessionLeaseBroker();
  let serverPort;
  const runtime = {
    id: 'eera-test',
    connect({ name }) {
      const pair = createPortPair(name);
      serverPort = pair.server;
      broker.handlePort(pair.server);
      return pair.client;
    },
  };
  const lease = createMicrophoneSessionLease({
    getRuntime: () => runtime,
    setIntervalFn: () => 1,
    clearIntervalFn() {},
    setTimeoutFn: () => 1,
    clearTimeoutFn() {},
  });
  const errors = [];
  lease.onLost((error) => errors.push(error));
  assert.equal(await lease.acquire(), true);

  serverPort.disconnect();
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /shared microphone session ended/i);
  lease.dispose();
});

test('lease client reports lost ownership from a restarted worker', async () => {
  const broker = createMicrophoneSessionLeaseBroker();
  let serverPort;
  const runtime = {
    id: 'eera-test',
    connect({ name }) {
      const pair = createPortPair(name);
      serverPort = pair.server;
      broker.handlePort(pair.server);
      return pair.client;
    },
  };
  const lease = createMicrophoneSessionLease({
    getRuntime: () => runtime,
    setIntervalFn: () => 1,
    clearIntervalFn() {},
    setTimeoutFn: () => 1,
    clearTimeoutFn() {},
  });
  const errors = [];
  lease.onLost((error) => errors.push(error));
  assert.equal(await lease.acquire(), true);

  serverPort.postMessage({ type: 'lost' });

  assert.equal(lease.isAcquired(), false);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /lost its shared microphone session/i);
  lease.dispose();
});
