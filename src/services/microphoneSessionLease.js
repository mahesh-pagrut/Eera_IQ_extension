export const MICROPHONE_SESSION_PORT = 'eera-microphone-session';

export function createMicrophoneSessionLeaseBroker({
  portName = MICROPHONE_SESSION_PORT,
} = {}) {
  let activePort = null;

  function handlePort(port) {
    if (port.name !== portName) return false;

    port.onMessage.addListener((message) => {
      if (message?.type === 'acquire') {
        if (activePort && activePort !== port) {
          port.postMessage({ type: 'denied' });
          return;
        }
        activePort = port;
        port.postMessage({ type: 'granted' });
        return;
      }

      if (message?.type === 'release' && activePort === port) {
        activePort = null;
        port.postMessage({ type: 'released' });
        return;
      }

      if (message?.type === 'heartbeat' && activePort !== port) {
        port.postMessage({ type: 'lost' });
      }
    });

    port.onDisconnect.addListener(() => {
      if (activePort === port) activePort = null;
    });
    return true;
  }

  return { handlePort };
}

export function createMicrophoneSessionLease({
  getRuntime = () => globalThis.chrome?.runtime ?? null,
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
  heartbeatIntervalMs = 20_000,
  acquireTimeoutMs = 5_000,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
} = {}) {
  let port = null;
  let acquired = false;
  let disposed = false;
  let heartbeatTimer = null;
  let acquireTimer = null;
  let pendingAcquire = null;
  let intentionalDisconnect = false;
  const lostListeners = new Set();

  function emitLost(error) {
    for (const listener of lostListeners) listener(error);
  }

  function stopHeartbeat() {
    if (heartbeatTimer !== null) clearIntervalFn(heartbeatTimer);
    heartbeatTimer = null;
  }

  function clearAcquireTimer() {
    if (acquireTimer !== null) clearTimeoutFn(acquireTimer);
    acquireTimer = null;
  }

  function disconnect() {
    if (!port) return;
    intentionalDisconnect = true;
    const currentPort = port;
    port = null;
    currentPort.disconnect();
    intentionalDisconnect = false;
  }

  function release() {
    stopHeartbeat();
    clearAcquireTimer();
    if (pendingAcquire) {
      pendingAcquire.resolve(false);
      pendingAcquire = null;
    }
    acquired = false;
    disconnect();
  }

  function attachPort(currentPort) {
    port = currentPort;
    currentPort.onMessage.addListener((message) => {
      if (disposed || currentPort !== port) return;
      if (message?.type === 'granted' && pendingAcquire) {
        clearAcquireTimer();
        pendingAcquire.resolve(true);
        pendingAcquire = null;
        acquired = true;
        heartbeatTimer = setIntervalFn(() => {
          if (currentPort === port && acquired) {
            currentPort.postMessage({ type: 'heartbeat' });
          }
        }, heartbeatIntervalMs);
      } else if (message?.type === 'denied' && pendingAcquire) {
        clearAcquireTimer();
        pendingAcquire.resolve(false);
        pendingAcquire = null;
        disconnect();
      } else if (message?.type === 'lost' && acquired) {
        stopHeartbeat();
        acquired = false;
        disconnect();
        emitLost(
          new Error(
            'Eera lost its shared microphone session. Deactivate and reactivate to try again.',
          ),
        );
      }
    });
    currentPort.onDisconnect.addListener(() => {
      if (currentPort !== port) return;
      const hadLease = acquired;
      port = null;
      acquired = false;
      stopHeartbeat();
      clearAcquireTimer();
      if (pendingAcquire) {
        pendingAcquire.resolve(false);
        pendingAcquire = null;
      }
      if (hadLease && !intentionalDisconnect && !disposed) {
        emitLost(
          new Error(
            'The shared microphone session ended. Deactivate and reactivate Eera to try again.',
          ),
        );
      }
    });
  }

  function acquire() {
    if (disposed) return Promise.resolve(false);
    if (acquired) return Promise.resolve(true);
    if (pendingAcquire) return pendingAcquire.promise;

    const runtime = getRuntime();
    if (!runtime?.id || typeof runtime.connect !== 'function') {
      return Promise.resolve(true);
    }

    let resolveAcquire;
    const promise = new Promise((resolve) => {
      resolveAcquire = resolve;
    });
    pendingAcquire = { resolve: resolveAcquire, promise };
    acquireTimer = setTimeoutFn(() => {
      acquireTimer = null;
      if (!pendingAcquire) return;
      pendingAcquire.resolve(false);
      pendingAcquire = null;
      disconnect();
    }, acquireTimeoutMs);
    try {
      attachPort(runtime.connect({ name: MICROPHONE_SESSION_PORT }));
      port.postMessage({ type: 'acquire' });
    } catch {
      clearAcquireTimer();
      pendingAcquire?.resolve(false);
      pendingAcquire = null;
      disconnect();
    }
    return promise;
  }

  function onLost(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Microphone lease listener must be a function.');
    }
    lostListeners.add(callback);
    return () => lostListeners.delete(callback);
  }

  function dispose() {
    if (disposed) return;
    release();
    disposed = true;
    lostListeners.clear();
  }

  return {
    acquire,
    release,
    onLost,
    isAcquired: () => acquired,
    dispose,
  };
}
