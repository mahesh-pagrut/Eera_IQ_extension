export const SUPPORTED_RECOGNITION_LANGUAGES = Object.freeze([
  'en-IN',
  'en-US',
  'hi-IN',
]);

export const DEFAULT_RECOGNITION_LANGUAGE = 'en-IN';

const ERROR_MESSAGES = Object.freeze({
  'not-allowed':
    'Microphone access was denied. Allow microphone access for Eera in Chrome site settings, then try again.',
  'service-not-allowed':
    'Chrome did not allow its speech recognition service. Check microphone and speech settings, then try again.',
  'audio-capture':
    'No microphone is available. Connect or enable a microphone, then try again.',
  'no-speech': 'No speech was detected. Try again when you are ready to speak.',
  network:
    'Chrome could not reach its speech recognition service. Check your connection and try again.',
  'language-not-supported':
    'Chrome does not support this recognition language. Choose another language and try again.',
  aborted: 'Speech recognition was stopped.',
});

function getRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function createRecognitionError(error) {
  const message =
    ERROR_MESSAGES[error?.error] ??
    (error?.name === 'NotAllowedError'
      ? ERROR_MESSAGES['not-allowed']
      : error?.name === 'NotFoundError'
        ? ERROR_MESSAGES['audio-capture']
        : 'Speech recognition stopped unexpectedly. Tap Listen to try again.');
  const recognitionError = new Error(message);
  recognitionError.code = error?.error ?? error?.name ?? 'unknown';
  return recognitionError;
}

export function createSpeechRecognitionService({
  language = DEFAULT_RECOGNITION_LANGUAGE,
  continuous = false,
  getRecognition = getRecognitionConstructor,
} = {}) {
  let recognition = null;
  let status = 'idle';
  let stopRequested = false;
  let disposed = false;
  let hasFinalResult = false;
  let lastTranscript = '';
  let lastFinalResultIndex = -1;
  let stopPromise = null;
  let resolveStop = null;
  const transcriptListeners = new Set();
  const errorListeners = new Set();
  const statusListeners = new Set();

  if (!SUPPORTED_RECOGNITION_LANGUAGES.includes(language)) {
    throw new RangeError(`Unsupported speech recognition language: ${language}`);
  }

  function emit(listeners, value) {
    for (const listener of listeners) listener(value);
  }

  function setStatus(nextStatus) {
    status = nextStatus;
    emit(statusListeners, status);
  }

  function reportError(error) {
    const recognitionError =
      error instanceof Error ? error : createRecognitionError(error);
    setStatus('error');
    emit(errorListeners, recognitionError);
  }

  function handleResult(event) {
    if (
      stopRequested ||
      disposed ||
      status === 'error' ||
      status === 'stopping' ||
      status === 'idle'
    ) {
      return;
    }

    const finalParts = [];
    const interimParts = [];
    const changedFinalParts = [];
    let resultIsFinal = false;
    const firstChangedResult = Number.isInteger(event.resultIndex)
      ? event.resultIndex
      : 0;

    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      const text = result[0]?.transcript?.trim();
      if (!text) continue;

      if (result.isFinal) {
        finalParts.push(text);
        if (
          index >= firstChangedResult &&
          (!continuous || index > lastFinalResultIndex)
        ) {
          resultIsFinal = true;
          changedFinalParts.push(text);
          lastFinalResultIndex = Math.max(lastFinalResultIndex, index);
        }
      } else {
        interimParts.push(text);
      }
    }

    if (resultIsFinal) hasFinalResult = true;
    lastTranscript = [...finalParts, ...interimParts].join(' ').trim();
    if (resultIsFinal) setStatus('processing');
    emit(transcriptListeners, {
      text: continuous
        ? resultIsFinal
          ? changedFinalParts.join(' ').trim()
          : interimParts.join(' ').trim()
        : lastTranscript,
      isFinal: resultIsFinal,
    });
  }

  function createRecognition() {
    let Recognition;
    try {
      Recognition = getRecognition();
    } catch (error) {
      reportError(createRecognitionError(error));
      return null;
    }
    if (!Recognition) {
      const error = new Error(
        'Speech recognition is unavailable in this browser context. Try the Eera new-tab page in Chrome.',
      );
      error.code = 'unsupported';
      reportError(error);
      return null;
    }

    let instance;
    try {
      instance = new Recognition();
    } catch (error) {
      reportError(createRecognitionError(error));
      return null;
    }
    instance.lang = language;
    instance.continuous = continuous;
    instance.interimResults = true;
    instance.maxAlternatives = 1;
    instance.onstart = () => {
      if (stopRequested || disposed) {
        instance.abort();
        return;
      }
      setStatus('listening');
    };
    instance.onresult = handleResult;
    instance.onerror = (event) => {
      if (event.error === 'aborted' && stopRequested) return;
      reportError(event);
    };
    instance.onend = () => {
      if (disposed) return;
      if (stopRequested) {
        stopRequested = false;
        setStatus('idle');
        resolveStop?.();
        resolveStop = null;
        stopPromise = null;
        return;
      }
      if (
        status === 'error' ||
        (status === 'processing' && !continuous)
      ) {
        return;
      }
      if (hasFinalResult && !continuous) {
        setStatus('processing');
        return;
      }
      reportError(
        new Error(
          continuous
            ? 'Continuous speech recognition disconnected unexpectedly. Eera will try to reconnect.'
            : 'Speech recognition ended before a final transcript was received. Tap Listen to try again.',
        ),
      );
    };
    recognition = instance;
    return instance;
  }

  function startListening() {
    if (disposed || status === 'starting' || status === 'listening') return false;

    const instance = recognition ?? createRecognition();
    if (!instance) return false;

    stopRequested = false;
    hasFinalResult = false;
    lastTranscript = '';
    lastFinalResultIndex = -1;
    instance.lang = language;
    setStatus('starting');

    try {
      instance.start();
      return true;
    } catch (error) {
      reportError(createRecognitionError(error));
      return false;
    }
  }

  function stopListening() {
    if (status === 'stopping') return stopPromise ?? Promise.resolve();
    if (
      !recognition ||
      !['starting', 'listening', 'processing'].includes(status)
    ) {
      return Promise.resolve();
    }

    stopRequested = true;
    const hasCompletedFinalResult = status === 'processing' && hasFinalResult;
    setStatus('stopping');
    stopPromise = new Promise((resolve) => {
      resolveStop = resolve;
    });
    try {
      if (hasCompletedFinalResult) {
        recognition.stop();
      } else {
        recognition.abort();
      }
    } catch (error) {
      if (error.name !== 'InvalidStateError') {
        reportError(createRecognitionError(error));
        stopRequested = false;
        resolveStop?.();
        resolveStop = null;
        stopPromise = null;
        return Promise.resolve();
      }
      stopRequested = false;
      setStatus('idle');
      resolveStop?.();
      resolveStop = null;
      stopPromise = null;
    }
    return stopPromise ?? Promise.resolve();
  }

  function setLanguage(nextLanguage) {
    if (!SUPPORTED_RECOGNITION_LANGUAGES.includes(nextLanguage)) {
      throw new RangeError(
        `Unsupported speech recognition language: ${nextLanguage}`,
      );
    }
    if (status === 'starting' || status === 'listening') {
      throw new Error('Stop speech recognition before changing its language.');
    }
    language = nextLanguage;
    if (recognition) recognition.lang = language;
  }

  function subscribe(listeners, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Speech recognition listener must be a function.');
    }
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  function dispose() {
    if (disposed) return;
    stopListening();
    resolveStop?.();
    resolveStop = null;
    stopPromise = null;
    disposed = true;
    if (recognition) {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition = null;
    }
    transcriptListeners.clear();
    errorListeners.clear();
    statusListeners.clear();
  }

  return {
    startListening,
    stopListening,
    setLanguage,
    onTranscript: (callback) => subscribe(transcriptListeners, callback),
    onError: (callback) => subscribe(errorListeners, callback),
    onStatusChange: (callback) => subscribe(statusListeners, callback),
    getStatus: () => status,
    getTranscript: () => lastTranscript,
    dispose,
  };
}
