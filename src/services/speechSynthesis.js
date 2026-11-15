export const SPEECH_LANGUAGES = Object.freeze(['en-IN', 'en-US', 'hi-IN']);
export const DEFAULT_SPEECH_CONFIGURATION = Object.freeze({
  language: 'en-IN',
  rate: 1,
  pitch: 1.05,
  volume: 1,
});

const RATE_RANGE = Object.freeze({ min: 0.1, max: 10 });
const PITCH_RANGE = Object.freeze({ min: 0, max: 2 });
const VOLUME_RANGE = Object.freeze({ min: 0, max: 1 });
const FEMALE_VOICE_NAME_PATTERN = /\b(female|feminine|woman|women)\b/i;

function getBrowserSynthesis() {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis ?? null;
}

function getUtteranceConstructor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechSynthesisUtterance ?? null;
}

function getExtensionRuntime() {
  return globalThis.chrome?.runtime ?? null;
}

function getExtensionTts() {
  return globalThis.chrome?.tts ?? null;
}

function validateRange(name, value, range) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < range.min ||
    value > range.max
  ) {
    throw new RangeError(
      `${name} must be a finite number between ${range.min} and ${range.max}.`,
    );
  }
}

function validateLanguage(language) {
  if (typeof language !== 'string' || !SPEECH_LANGUAGES.includes(language)) {
    throw new RangeError(
      `Language must be one of: ${SPEECH_LANGUAGES.join(', ')}.`,
    );
  }
}

function isFemaleVoice(voice) {
  return (
    String(voice.gender ?? '').toLowerCase() === 'female' ||
    FEMALE_VOICE_NAME_PATTERN.test(voice.name ?? '')
  );
}

function createChromeTtsService({
  configuration,
  runtime,
  tts,
  getSynthesis,
  getUtterance,
}) {
  const statusListeners = new Set();
  const errorListeners = new Set();
  const voiceListeners = new Set();
  let disposed = false;
  let status = 'idle';
  let requestGeneration = 0;
  let preferredVoiceURI = null;
  let availableVoices = [];
  let port = null;
  let fallbackService = null;
  let fallbackActive = false;
  let currentSpeech = null;

  function emit(listeners, value) {
    for (const listener of listeners) listener(value);
  }

  function setStatus(nextStatus) {
    status = nextStatus;
    emit(statusListeners, status);
  }

  function reportError(error) {
    const speechError =
      error instanceof Error ? error : new Error('Speech synthesis failed.');
    setStatus('error');
    emit(errorListeners, speechError);
  }

  function ensureFallbackService() {
    if (fallbackService) return fallbackService;
    fallbackService = createSpeechSynthesisService({
      ...configuration,
      getRuntime: () => null,
      getSynthesis,
      getUtterance,
    });
    fallbackService.onStatusChange((nextStatus) => {
      if (fallbackActive) setStatus(nextStatus);
    });
    fallbackService.onError((error) => {
      if (fallbackActive) reportError(error);
    });
    fallbackService.onVoicesChange((voices) => {
      if (!fallbackActive) return;
      availableVoices = voices;
      emit(voiceListeners, [...availableVoices]);
    });
    return fallbackService;
  }

  function startFallback(request) {
    if (
      disposed ||
      !request ||
      request.requestId !== requestGeneration
    ) {
      return false;
    }
    if (fallbackActive) return true;

    try {
      const fallback = ensureFallbackService();
      fallback.configure(request.configuration);
      if (
        preferredVoiceURI &&
        fallback.getVoices().some((voice) => voice.voiceURI === preferredVoiceURI)
      ) {
        fallback.setPreferredVoice(preferredVoiceURI);
      }
      fallbackActive = true;
      const started = fallback.speak(request.text, request.configuration);
      if (!started) fallbackActive = false;
      return started;
    } catch {
      fallbackActive = false;
      return false;
    }
  }

  function normalizeVoices(voices) {
    return voices.map((voice) => ({
      name: voice.voiceName,
      lang: voice.lang,
      voiceURI: voice.voiceName,
      gender: voice.gender,
      default: false,
    }));
  }

  function getSelectedVoice() {
    if (preferredVoiceURI) {
      const selected = availableVoices.find(
        (voice) => voice.voiceURI === preferredVoiceURI,
      );
      if (selected) return selected;
    }
    return selectPreferredVoice(availableVoices, configuration.language);
  }

  function isSupported() {
    return Boolean(
      tts?.speak ||
        (runtime?.id && typeof runtime.connect === 'function'),
    );
  }

  function handleTtsEvent(requestId, event) {
    if (disposed || fallbackActive || requestId !== requestGeneration) return;
    switch (event?.type) {
      case 'start':
        setStatus('speaking');
        break;
      case 'end':
      case 'interrupted':
      case 'cancelled':
        currentSpeech = null;
        setStatus('idle');
        break;
      case 'error':
        if (!startFallback(currentSpeech)) {
          reportError(
            new Error(event.errorMessage || 'Chrome could not speak that text.'),
          );
        }
        break;
      default:
        break;
    }
  }

  function refreshChromeVoices() {
    try {
      tts.getVoices((voices) => {
        const error = runtime.lastError;
        if (error) {
          reportError(
            new Error(`Could not retrieve Chrome speech voices: ${error.message}`),
          );
          return;
        }
        availableVoices = normalizeVoices(voices ?? []);
        emit(voiceListeners, [...availableVoices]);
      });
    } catch (error) {
      reportError(error);
    }
  }

  function ensurePort() {
    if (disposed) throw new Error('Speech synthesis service has been disposed.');
    if (port) return port;
    if (!isSupported()) {
      throw new Error('Chrome extension speech output is unavailable.');
    }

    port = runtime.connect({ name: 'eera-tts' });
    port.onMessage.addListener((message) => {
      if (disposed) return;
      if (message?.type === 'voices') {
        availableVoices = normalizeVoices(message.voices ?? []);
        emit(voiceListeners, [...availableVoices]);
        return;
      }
      if (message?.type === 'error') {
        if (message.requestId === null) {
          reportError(new Error(message.message || 'Speech synthesis failed.'));
        } else if (message.requestId === requestGeneration) {
          if (!startFallback(currentSpeech)) {
            reportError(new Error(message.message || 'Speech synthesis failed.'));
          }
        }
        return;
      }
      if (message?.type !== 'event' || message.requestId !== requestGeneration) {
        return;
      }

      handleTtsEvent(message.requestId, message.event);
    });
    port.onDisconnect.addListener(() => {
      const wasDisposed = disposed;
      const disconnectMessage = runtime.lastError?.message;
      port = null;
      if (!wasDisposed) {
        if (!startFallback(currentSpeech)) {
          reportError(
            new Error(
              disconnectMessage
                ? `Eera's background speech service is unavailable: ${disconnectMessage}`
                : 'Eera lost its background speech connection. Reload the extension and retry.',
            ),
          );
        }
      }
    });
    return port;
  }

  function send(message) {
    try {
      ensurePort().postMessage(message);
      return true;
    } catch (error) {
      if (message.type === 'speak' && startFallback(currentSpeech)) return true;
      reportError(error);
      return false;
    }
  }

  function configure(nextConfiguration = {}) {
    const next = { ...configuration, ...nextConfiguration };
    validateLanguage(next.language);
    validateRange('rate', next.rate, RATE_RANGE);
    validateRange('pitch', next.pitch, PITCH_RANGE);
    validateRange('volume', next.volume, VOLUME_RANGE);
    Object.assign(configuration, next);
    return { ...configuration };
  }

  function setPreferredVoice(voiceURI) {
    if (voiceURI === null || voiceURI === '') {
      preferredVoiceURI = null;
      return;
    }
    if (typeof voiceURI !== 'string') {
      throw new TypeError('Voice selection must be a voice URI or null.');
    }
    if (!availableVoices.some((voice) => voice.voiceURI === voiceURI)) {
      throw new RangeError('The selected speech voice is not available.');
    }
    preferredVoiceURI = voiceURI;
  }

  function speak(text, overrides = {}) {
    if (typeof text !== 'string' || !text.trim()) {
      throw new TypeError('Speech text must be a non-empty string.');
    }
    const nextConfiguration = configure(overrides);
    const requestId = ++requestGeneration;
    if (fallbackActive) fallbackService?.stopSpeaking();
    fallbackActive = false;
    const voice = getSelectedVoice();
    currentSpeech = {
      requestId,
      text: text.trim(),
      configuration: nextConfiguration,
    };
    fallbackActive = false;
    setStatus('starting');
    if (tts?.speak) {
      const options = {
        lang: nextConfiguration.language,
        rate: nextConfiguration.rate,
        pitch: nextConfiguration.pitch,
        volume: nextConfiguration.volume,
        enqueue: false,
        onEvent: (event) => handleTtsEvent(requestId, event),
      };
      if (voice?.voiceURI) options.voiceName = voice.voiceURI;
      try {
        tts.stop();
        tts.speak(text.trim(), options, () => {
          const error = runtime.lastError;
          if (error && requestId === requestGeneration) {
            if (!startFallback(currentSpeech)) {
              reportError(new Error(`Chrome could not start speech: ${error.message}`));
            }
          }
        });
        return true;
      } catch (error) {
        return startFallback(currentSpeech) || (reportError(error), false);
      }
    }
    return send({
      type: 'speak',
      requestId,
      text: text.trim(),
      options: {
        language: nextConfiguration.language,
        rate: nextConfiguration.rate,
        pitch: nextConfiguration.pitch,
        volume: nextConfiguration.volume,
        voiceName: voice?.voiceURI,
      },
    });
  }

  function stopSpeaking() {
    const requestId = ++requestGeneration;
    currentSpeech = null;
    if (fallbackActive) fallbackService?.stopSpeaking();
    fallbackActive = false;
    if (tts?.stop) {
      try {
        tts.stop();
      } catch (error) {
        reportError(error);
      }
    } else if (port) {
      port.postMessage({ type: 'stop', requestId });
    }
    setStatus('idle');
  }

  function subscribe(listeners, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Speech synthesis listener must be a function.');
    }
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  function dispose() {
    if (disposed) return;
    stopSpeaking();
    disposed = true;
    fallbackActive = false;
    fallbackService?.dispose();
    fallbackService = null;
    port?.disconnect();
    port = null;
    availableVoices = [];
    statusListeners.clear();
    errorListeners.clear();
    voiceListeners.clear();
  }

  return {
    isSupported,
    getVoices: () => [...availableVoices],
    getSelectedVoice,
    getConfiguration: () => ({ ...configuration }),
    getStatus: () => status,
    configure,
    setPreferredVoice,
    speak,
    stopSpeaking,
    onVoicesChange: (callback) => {
      const unsubscribe = subscribe(voiceListeners, callback);
      callback([...availableVoices]);
      if (tts?.getVoices) {
        refreshChromeVoices();
      } else {
        send({ type: 'get-voices' });
      }
      return unsubscribe;
    },
    onStatusChange: (callback) => subscribe(statusListeners, callback),
    onError: (callback) => subscribe(errorListeners, callback),
    dispose,
  };
}

export function selectPreferredVoice(voices, language) {
  validateLanguage(language);
  if (!Array.isArray(voices) || voices.length === 0) return null;

  const requestedLanguage = language.toLowerCase();
  const requestedBase = requestedLanguage.split('-')[0];
  const localized = voices.filter(
    (voice) => voice.lang?.toLowerCase() === requestedLanguage,
  );
  const compatible = voices.filter(
    (voice) => voice.lang?.toLowerCase().split('-')[0] === requestedBase,
  );
  const candidates = localized.length > 0 ? localized : compatible;

  if (candidates.length > 0) {
    return (
      candidates.find(isFemaleVoice) ??
      candidates.find((voice) => voice.default) ??
      candidates[0]
    );
  }

  return voices.find((voice) => voice.default) ?? voices[0];
}

export function createSpeechSynthesisService({
  language = DEFAULT_SPEECH_CONFIGURATION.language,
  rate = DEFAULT_SPEECH_CONFIGURATION.rate,
  pitch = DEFAULT_SPEECH_CONFIGURATION.pitch,
  volume = DEFAULT_SPEECH_CONFIGURATION.volume,
  getSynthesis = getBrowserSynthesis,
  getUtterance = getUtteranceConstructor,
  getRuntime = getExtensionRuntime,
  getTts = getExtensionTts,
} = {}) {
  const configuration = { language, rate, pitch, volume };
  validateLanguage(configuration.language);
  validateRange('rate', configuration.rate, RATE_RANGE);
  validateRange('pitch', configuration.pitch, PITCH_RANGE);
  validateRange('volume', configuration.volume, VOLUME_RANGE);

  const runtime = getRuntime();
  if (runtime?.id && typeof runtime.connect === 'function') {
    return createChromeTtsService({
      configuration,
      runtime,
      tts: getTts(),
      getSynthesis,
      getUtterance,
    });
  }

  const statusListeners = new Set();
  const errorListeners = new Set();
  const voiceListeners = new Set();
  let disposed = false;
  let status = 'idle';
  let utteranceGeneration = 0;
  let currentUtterance = null;
  let preferredVoiceURI = null;
  let availableVoices = [];
  let synthesis = null;
  let voicesChangedHandler = null;
  let previousOnVoicesChanged = null;
  let assignedOnVoicesChanged = null;

  function emit(listeners, value) {
    for (const listener of listeners) listener(value);
  }

  function setStatus(nextStatus) {
    status = nextStatus;
    emit(statusListeners, status);
  }

  function reportError(error) {
    const speechError =
      error instanceof Error ? error : new Error('Speech synthesis failed.');
    setStatus('error');
    emit(errorListeners, speechError);
  }

  function refreshVoices() {
    if (disposed || !synthesis) return availableVoices;
    availableVoices = synthesis.getVoices();
    emit(voiceListeners, [...availableVoices]);
    return availableVoices;
  }

  function listVoices() {
    if (!synthesis && isSupported()) ensureSynthesis();
    return [...availableVoices];
  }

  function getSelectedVoice() {
    if (preferredVoiceURI) {
      const selected = availableVoices.find(
        (voice) => voice.voiceURI === preferredVoiceURI,
      );
      if (selected) return selected;
    }
    return selectPreferredVoice(availableVoices, configuration.language);
  }

  function isSupported() {
    try {
      return Boolean(getSynthesis() && getUtterance());
    } catch {
      return false;
    }
  }

  function ensureSynthesis() {
    if (disposed) throw new Error('Speech synthesis service has been disposed.');
    if (synthesis) return synthesis;

    synthesis = getSynthesis();
    const Utterance = getUtterance();
    if (!synthesis || !Utterance) {
      throw new Error(
        'Speech synthesis is unavailable in this browser context.',
      );
    }
    refreshVoices();

    voicesChangedHandler = () => refreshVoices();
    if (typeof synthesis.addEventListener === 'function') {
      synthesis.addEventListener('voiceschanged', voicesChangedHandler);
    } else {
      previousOnVoicesChanged = synthesis.onvoiceschanged;
      assignedOnVoicesChanged = (...args) => {
        previousOnVoicesChanged?.apply(synthesis, args);
        voicesChangedHandler();
      };
      synthesis.onvoiceschanged = assignedOnVoicesChanged;
    }
    return synthesis;
  }

  function subscribe(listeners, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Speech synthesis listener must be a function.');
    }
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  function configure(nextConfiguration = {}) {
    const next = { ...configuration, ...nextConfiguration };
    validateLanguage(next.language);
    validateRange('rate', next.rate, RATE_RANGE);
    validateRange('pitch', next.pitch, PITCH_RANGE);
    validateRange('volume', next.volume, VOLUME_RANGE);

    configuration.language = next.language;
    configuration.rate = next.rate;
    configuration.pitch = next.pitch;
    configuration.volume = next.volume;
    return { ...configuration };
  }

  function setPreferredVoice(voiceURI) {
    if (voiceURI === null || voiceURI === '') {
      preferredVoiceURI = null;
      return;
    }
    if (typeof voiceURI !== 'string') {
      throw new TypeError('Voice selection must be a voice URI or null.');
    }
    const voice = availableVoices.find((item) => item.voiceURI === voiceURI);
    if (!voice) {
      throw new RangeError('The selected speech voice is not available.');
    }
    preferredVoiceURI = voiceURI;
  }

  function speak(text, overrides = {}) {
    if (typeof text !== 'string' || !text.trim()) {
      throw new TypeError('Speech text must be a non-empty string.');
    }

    const activeSynthesis = ensureSynthesis();
    const nextConfiguration = configure(overrides);
    const Utterance = getUtterance();
    const generation = ++utteranceGeneration;

    if (currentUtterance) {
      currentUtterance.onstart = null;
      currentUtterance.onend = null;
      currentUtterance.onerror = null;
      currentUtterance = null;
    }
    try {
      activeSynthesis.cancel();
    } catch (error) {
      reportError(error);
      return false;
    }
    const utterance = new Utterance(text);
    currentUtterance = utterance;
    utterance.lang = nextConfiguration.language;
    utterance.rate = nextConfiguration.rate;
    utterance.pitch = nextConfiguration.pitch;
    utterance.volume = nextConfiguration.volume;

    const voice = getSelectedVoice();
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      if (!disposed && generation === utteranceGeneration) setStatus('speaking');
    };
    utterance.onend = () => {
      if (
        !disposed &&
        generation === utteranceGeneration &&
        status !== 'error'
      ) {
        setStatus('idle');
      }
      if (currentUtterance === utterance) currentUtterance = null;
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
    };
    utterance.onerror = (event) => {
      if (disposed || generation !== utteranceGeneration) return;
      if (event.error === 'canceled' || event.error === 'interrupted') {
        setStatus('idle');
        if (currentUtterance === utterance) currentUtterance = null;
        utterance.onstart = null;
        utterance.onend = null;
        utterance.onerror = null;
        return;
      }
      reportError(
        new Error(
          event.error
            ? `Speech synthesis failed: ${event.error}.`
            : 'Speech synthesis failed unexpectedly.',
        ),
      );
      if (currentUtterance === utterance) currentUtterance = null;
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
    };

    setStatus('starting');
    try {
      activeSynthesis.speak(utterance);
      return true;
    } catch (error) {
      reportError(error);
      return false;
    }
  }

  function stopSpeaking() {
    if (!synthesis) return;
    utteranceGeneration += 1;
    if (currentUtterance) {
      currentUtterance.onstart = null;
      currentUtterance.onend = null;
      currentUtterance.onerror = null;
      currentUtterance = null;
    }
    try {
      synthesis.cancel();
      setStatus('idle');
    } catch (error) {
      reportError(error);
    }
  }

  function dispose() {
    if (disposed) return;
    stopSpeaking();
    disposed = true;
    if (synthesis && voicesChangedHandler) {
      if (typeof synthesis.removeEventListener === 'function') {
        synthesis.removeEventListener('voiceschanged', voicesChangedHandler);
      } else if (synthesis.onvoiceschanged === assignedOnVoicesChanged) {
        synthesis.onvoiceschanged = previousOnVoicesChanged;
      }
    }
    synthesis = null;
    voicesChangedHandler = null;
    assignedOnVoicesChanged = null;
    availableVoices = [];
    statusListeners.clear();
    errorListeners.clear();
    voiceListeners.clear();
  }

  return {
    isSupported,
    getVoices: listVoices,
    getSelectedVoice,
    getConfiguration: () => ({ ...configuration }),
    getStatus: () => status,
    configure,
    setPreferredVoice,
    speak,
    stopSpeaking,
    onVoicesChange: (callback) => {
      const unsubscribe = subscribe(voiceListeners, callback);
      const alreadyInitialized = Boolean(synthesis);
      if (isSupported()) {
        try {
          ensureSynthesis();
        } catch (error) {
          reportError(error);
        }
      }
      if (alreadyInitialized || !isSupported()) {
        callback([...availableVoices]);
      }
      return unsubscribe;
    },
    onStatusChange: (callback) => subscribe(statusListeners, callback),
    onError: (callback) => subscribe(errorListeners, callback),
    dispose,
  };
}
