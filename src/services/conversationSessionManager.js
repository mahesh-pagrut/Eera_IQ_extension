import {
  DEFAULT_CONVERSATION_SESSION_CONFIG,
  DEFAULT_WAKE_WORD,
} from './wakeWord/wakeWordConfig.js';
import { detectWakeWord } from './wakeWord/wakeWordDetector.js';

export const CONVERSATION_SESSION_STATES = Object.freeze({
  INACTIVE: 'inactive',
  ACQUIRING: 'acquiring',
  WAKE_WORD_STANDBY: 'wake-word-standby',
  COMMAND_LISTENING: 'command-listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  FOLLOW_UP: 'follow-up',
  RETURNING_TO_STANDBY: 'returning-to-standby',
  ERROR: 'error',
});

const TERMINAL_RECOGNITION_ERRORS = new Set([
  'not-allowed',
  'NotAllowedError',
  'NotFoundError',
  'service-not-allowed',
  'audio-capture',
  'language-not-supported',
  'unsupported',
]);

export function createConversationSessionManager({
  recognition,
  microphoneLease,
  onRequest,
  onTranscript = () => {},
  onStateChange = () => {},
  onError = () => {},
  onDeactivation = () => {},
  wakeWord = DEFAULT_WAKE_WORD,
  followUpWindowMs = DEFAULT_CONVERSATION_SESSION_CONFIG.followUpWindowMs,
  inactivityTimeoutMs = DEFAULT_CONVERSATION_SESSION_CONFIG.inactivityTimeoutMs,
  maxRecoveryAttempts = DEFAULT_CONVERSATION_SESSION_CONFIG.maxRecoveryAttempts,
  recoveryDelaysMs = DEFAULT_CONVERSATION_SESSION_CONFIG.recoveryDelaysMs,
  now = Date.now,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
} = {}) {
  if (!recognition) {
    throw new TypeError('Conversation session manager requires recognition.');
  }
  if (typeof onRequest !== 'function') {
    throw new TypeError('Conversation session manager requires an onRequest handler.');
  }
  for (const [name, value] of [
    ['followUpWindowMs', followUpWindowMs],
    ['inactivityTimeoutMs', inactivityTimeoutMs],
    ['maxRecoveryAttempts', maxRecoveryAttempts],
  ]) {
    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      (name === 'maxRecoveryAttempts' && !Number.isInteger(value))
    ) {
      throw new RangeError(`${name} must be a positive finite number.`);
    }
  }
  if (
    !Array.isArray(recoveryDelaysMs) ||
    recoveryDelaysMs.length === 0 ||
    recoveryDelaysMs.some((delay) => !Number.isFinite(delay) || delay < 0)
  ) {
    throw new RangeError(
      'recoveryDelaysMs must contain non-negative finite delays.',
    );
  }

  let state = CONVERSATION_SESSION_STATES.INACTIVE;
  let active = false;
  let disposed = false;
  let recognitionRole = null;
  let requestPending = false;
  let speechActive = false;
  let requestGeneration = 0;
  let recoveryAttempts = 0;
  let recoveryRole = null;
  let activationPromise = null;
  let followUpTimer = null;
  let inactivityTimer = null;
  let recoveryTimer = null;
  let disposeTimer = null;
  let disposalFinalized = false;
  let followUpDeadline = 0;
  let inactivityDeadline = 0;
  const unsubscribe = [];

  function transition(nextState) {
    if (disposed || state === nextState) return;
    state = nextState;
    onStateChange(state);
  }

  function clearTimer(timerName) {
    if (timerName === 'followUp' && followUpTimer !== null) {
      clearTimeoutFn(followUpTimer);
      followUpTimer = null;
    } else if (timerName === 'inactivity' && inactivityTimer !== null) {
      clearTimeoutFn(inactivityTimer);
      inactivityTimer = null;
    } else if (timerName === 'recovery' && recoveryTimer !== null) {
      clearTimeoutFn(recoveryTimer);
      recoveryTimer = null;
    }
  }

  function clearAllTimers() {
    clearTimer('followUp');
    clearTimer('inactivity');
    clearTimer('recovery');
  }

  function resetInactivityTimer() {
    clearTimer('inactivity');
    inactivityDeadline = now() + inactivityTimeoutMs;
    inactivityTimer = setTimeoutFn(() => {
      inactivityTimer = null;
      if (active && now() >= inactivityDeadline) {
        void deactivate('inactivity');
      } else if (active) {
        resetInactivityTimer();
      }
    }, inactivityTimeoutMs);
  }

  function noteActivity() {
    if (!active) return;
    resetInactivityTimer();
    if (state === CONVERSATION_SESSION_STATES.FOLLOW_UP) {
      resetFollowUpTimer();
    }
  }

  async function stopRecognition() {
    recognitionRole = null;
    await recognition.stopListening();
  }

  function startRecognition(role) {
    if (!active || disposed || recognitionRole) return false;
    const currentStatus = recognition.getStatus?.();
    if (['starting', 'listening', 'processing', 'stopping'].includes(currentStatus)) {
      return false;
    }

    recognitionRole = role;
    const started = recognition.startListening();
    if (!started) recognitionRole = null;
    return started;
  }

  function fail(error, { terminal = true } = {}) {
    if (!active || disposed) return;
    const normalizedError =
      error instanceof Error ? error : new Error('Speech recognition failed.');
    onError(normalizedError);

    if (terminal || recoveryAttempts >= maxRecoveryAttempts) {
      active = false;
      requestPending = false;
      speechActive = false;
      recognitionRole = null;
      recoveryRole = null;
      clearAllTimers();
      void recognition.stopListening();
      microphoneLease?.release();
      transition(CONVERSATION_SESSION_STATES.ERROR);
      return;
    }

    const role = recognitionRole ?? (
      state === CONVERSATION_SESSION_STATES.FOLLOW_UP ? 'follow-up' : 'wake'
    );
    recognitionRole = null;
    recoveryRole = role;
    recoveryAttempts += 1;
    const delay =
      recoveryDelaysMs[
        Math.min(recoveryAttempts - 1, recoveryDelaysMs.length - 1)
      ];
    transition(CONVERSATION_SESSION_STATES.ERROR);
    clearTimer('recovery');
    recoveryTimer = setTimeoutFn(() => {
      recoveryTimer = null;
      if (!active || disposed) return;
      recoveryRole = null;
      transition(
        role === 'follow-up'
          ? CONVERSATION_SESSION_STATES.FOLLOW_UP
          : role === 'command'
            ? CONVERSATION_SESSION_STATES.COMMAND_LISTENING
            : CONVERSATION_SESSION_STATES.WAKE_WORD_STANDBY,
      );
      if (!startRecognition(role)) {
        fail(
          new Error('Eera could not restart speech recognition. Deactivate and retry.'),
          { terminal: recoveryAttempts >= maxRecoveryAttempts },
        );
      }
    }, delay);
  }

  async function processRequest(text) {
    if (!active || disposed || requestPending || !text.trim()) return;
    requestPending = true;
    const currentRequestGeneration = ++requestGeneration;
    speechActive = false;
    recoveryAttempts = 0;
    recoveryRole = null;
    noteActivity();
    clearTimer('followUp');
    transition(CONVERSATION_SESSION_STATES.PROCESSING);

    try {
      await stopRecognition();
      if (
        !active ||
        disposed ||
        currentRequestGeneration !== requestGeneration
      ) {
        return;
      }
      const result = await onRequest(text);
      if (
        !active ||
        disposed ||
        currentRequestGeneration !== requestGeneration
      ) {
        return;
      }
      if (!result?.speechStarted) {
        requestPending = false;
        enterFollowUp();
      }
    } catch (error) {
      if (
        !active ||
        disposed ||
        currentRequestGeneration !== requestGeneration
      ) {
        return;
      }
      requestPending = false;
      onError(
        error instanceof Error
          ? error
          : new Error('Eera could not process that request.'),
      );
      enterFollowUp();
    }
  }

  async function handleWakeWord(transcript) {
    const match = detectWakeWord(transcript, wakeWord);
    if (!match.matched) return;

    noteActivity();
    recoveryAttempts = 0;
    recoveryRole = null;
    recognitionRole = null;
    clearTimer('recovery');
    transition(CONVERSATION_SESSION_STATES.COMMAND_LISTENING);
    await recognition.stopListening();
    if (!active || disposed) return;
    if (match.remainder) {
      await processRequest(match.remainder);
      return;
    }
    if (!startRecognition('command')) {
      fail(new Error('Eera could not start listening for your request.'));
    }
  }

  function resetFollowUpTimer() {
    clearTimer('followUp');
    followUpDeadline = now() + followUpWindowMs;
    followUpTimer = setTimeoutFn(() => {
      followUpTimer = null;
      if (
        !active ||
        (state !== CONVERSATION_SESSION_STATES.FOLLOW_UP &&
          !(state === CONVERSATION_SESSION_STATES.ERROR &&
            recoveryRole === 'follow-up'))
      ) {
        return;
      }
      if (now() < followUpDeadline) {
        resetFollowUpTimer();
        return;
      }
      void returnToWakeWordStandby();
    }, followUpWindowMs);
  }

  async function returnToWakeWordStandby() {
    clearTimer('followUp');
    clearTimer('recovery');
    recoveryRole = null;
    transition(CONVERSATION_SESSION_STATES.RETURNING_TO_STANDBY);
    await stopRecognition();
    if (!active || disposed) return;
    transition(CONVERSATION_SESSION_STATES.WAKE_WORD_STANDBY);
    if (!startRecognition('wake')) {
      fail(new Error('Eera could not return to wake-word standby.'));
    }
  }

  function enterFollowUp() {
    if (!active || disposed) return;
    requestPending = false;
    speechActive = false;
    transition(CONVERSATION_SESSION_STATES.FOLLOW_UP);
    resetFollowUpTimer();
    if (!startRecognition('follow-up')) {
      fail(new Error('Eera could not start the follow-up listening window.'));
    }
  }

  function handleTranscript({ text, isFinal }) {
    if (!active || disposed || !recognitionRole || !text?.trim()) return;
    const role = recognitionRole;
    onTranscript({ text, isFinal, role });

    if (role === 'wake') {
      if (isFinal) void handleWakeWord(text);
      return;
    }

    if (role === 'command' || role === 'follow-up') {
      if (role === 'follow-up' && state === CONVERSATION_SESSION_STATES.FOLLOW_UP) {
        noteActivity();
        resetFollowUpTimer();
      }
      if (isFinal) {
        recognitionRole = null;
        void processRequest(text);
      }
    }
  }

  function handleRecognitionError(error) {
    if (!recognitionRole || requestPending || !active) return;
    const code = error?.code ?? error?.error;
    fail(error, { terminal: TERMINAL_RECOGNITION_ERRORS.has(code) });
  }

  function handleSpeechStatus(status) {
    if (!active || disposed) return;
    if (status === 'starting' || status === 'speaking') {
      speechActive = true;
      clearTimer('followUp');
      transition(CONVERSATION_SESSION_STATES.SPEAKING);
      return;
    }
    if (status === 'idle' && speechActive) {
      speechActive = false;
      requestPending = false;
      enterFollowUp();
    } else if (status === 'error' && speechActive) {
      speechActive = false;
      requestPending = false;
      enterFollowUp();
    }
  }

  function activate() {
    if (disposed) return Promise.resolve(false);
    if (active) return Promise.resolve(true);
    if (activationPromise) return activationPromise;

    active = true;
    transition(CONVERSATION_SESSION_STATES.ACQUIRING);
    activationPromise = (async () => {
      try {
        const acquired = await (microphoneLease?.acquire() ?? true);
        if (!active || disposed) {
          if (acquired) microphoneLease?.release();
          return false;
        }
        if (!acquired) {
          throw new Error(
            'Another Eera tab is using the microphone. Deactivate it before activating Eera here.',
          );
        }
        resetInactivityTimer();
        transition(CONVERSATION_SESSION_STATES.WAKE_WORD_STANDBY);
        if (!startRecognition('wake')) {
          if (state === CONVERSATION_SESSION_STATES.ERROR) return false;
          throw new Error(
            'Eera could not start speech recognition. Check microphone permission and try again.',
          );
        }
        return true;
      } catch (error) {
        active = false;
        clearAllTimers();
        microphoneLease?.release();
        onError(error instanceof Error ? error : new Error('Eera could not activate.'));
        transition(CONVERSATION_SESSION_STATES.ERROR);
        return false;
      } finally {
        activationPromise = null;
      }
    })();
    return activationPromise;
  }

  async function deactivate(reason = 'manual') {
    if (!active && state === CONVERSATION_SESSION_STATES.INACTIVE) return;
    active = false;
    requestGeneration += 1;
    requestPending = false;
    speechActive = false;
    recognitionRole = null;
    clearAllTimers();
    await recognition.stopListening();
    microphoneLease?.release();
    transition(CONVERSATION_SESSION_STATES.INACTIVE);
    onDeactivation(reason);
  }

  async function setLanguage(nextLanguage) {
    if (!active || !recognitionRole) {
      recognition.setLanguage(nextLanguage);
      return;
    }
    const role = recognitionRole;
    clearTimer('recovery');
    recognitionRole = null;
    await recognition.stopListening();
    if (!active || disposed) return;
    recognition.setLanguage(nextLanguage);
    if (!startRecognition(role)) {
      fail(new Error('Eera could not restart listening with that language.'));
    }
  }

  async function resetToWakeWordStandby() {
    if (!active || disposed) return;
    requestGeneration += 1;
    requestPending = false;
    speechActive = false;
    recoveryAttempts = 0;
    recoveryRole = null;
    clearTimer('followUp');
    clearTimer('recovery');
    await stopRecognition();
    if (!active || disposed) return;
    transition(CONVERSATION_SESSION_STATES.WAKE_WORD_STANDBY);
    if (!startRecognition('wake')) {
      fail(new Error('Eera could not return to wake-word standby.'));
    }
  }

  function handleLeaseLost(error) {
    fail(error, { terminal: true });
  }

  unsubscribe.push(
    recognition.onTranscript(handleTranscript),
    recognition.onError(handleRecognitionError),
  );
  if (microphoneLease?.onLost) {
    unsubscribe.push(microphoneLease.onLost(handleLeaseLost));
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    active = false;
    requestGeneration += 1;
    clearAllTimers();
    for (const unsubscribeListener of unsubscribe) unsubscribeListener();
    function finalizeDisposal() {
      if (disposalFinalized) return;
      disposalFinalized = true;
      if (disposeTimer !== null) clearTimeoutFn(disposeTimer);
      disposeTimer = null;
      recognition.dispose?.();
      microphoneLease?.dispose?.();
      microphoneLease?.release?.();
    }

    disposeTimer = setTimeoutFn(finalizeDisposal, 1_500);
    Promise.resolve(recognition.stopListening()).then(
      finalizeDisposal,
      finalizeDisposal,
    );
  }

  return {
    activate,
    deactivate,
    dispose,
    getState: () => state,
    getRecognitionRole: () => recognitionRole,
    isActive: () => active,
    noteActivity,
    pauseRecognition: stopRecognition,
    resetToWakeWordStandby,
    setLanguage,
    handleSpeechStatus,
  };
}
