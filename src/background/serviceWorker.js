import { createMicrophoneSessionLeaseBroker } from '../services/microphoneSessionLease.js';

console.info('Eera background service worker ready.');

chrome.runtime.onInstalled.addListener(() => {
  console.info('Eera extension installed.');
});

let activeSpeech = null;
const disconnectedPorts = new WeakSet();

function postToPort(port, message) {
  if (disconnectedPorts.has(port)) return;
  port.postMessage(message);
}

function handleTtsMessage(port, message) {
  if (message?.type === 'get-voices') {
    if (!chrome.tts?.getVoices) {
      postToPort(port, {
        type: 'error',
        requestId: null,
        message: 'Chrome text-to-speech is unavailable in this browser.',
      });
      return;
    }
    chrome.tts.getVoices((voices) => {
      const error = chrome.runtime.lastError;
      if (error) {
        postToPort(port, {
          type: 'error',
          requestId: null,
          message: `Could not retrieve Chrome speech voices: ${error.message}`,
        });
        return;
      }
      postToPort(port, { type: 'voices', voices: voices ?? [] });
    });
    return;
  }

  if (message?.type === 'stop') {
    if (activeSpeech?.port === port) {
      chrome.tts.stop();
      activeSpeech = null;
    }
    return;
  }

  if (message?.type !== 'speak') return;
  if (!chrome.tts?.speak) {
    postToPort(port, {
      type: 'error',
      requestId: message.requestId,
      message: 'Chrome text-to-speech is unavailable in this browser.',
    });
    return;
  }

  const { requestId, text, options } = message;
  if (
    !Number.isInteger(requestId) ||
    typeof text !== 'string' ||
    !text.trim() ||
    text.length > 2000 ||
    !['en-IN', 'en-US', 'hi-IN'].includes(options?.language) ||
    !Number.isFinite(options.rate) ||
    options.rate < 0.1 ||
    options.rate > 10 ||
    !Number.isFinite(options.pitch) ||
    options.pitch < 0 ||
    options.pitch > 2 ||
    !Number.isFinite(options.volume) ||
    options.volume < 0 ||
    options.volume > 1 ||
    (options.voiceName !== undefined &&
      (typeof options.voiceName !== 'string' || options.voiceName.length > 250))
  ) {
    postToPort(port, {
      type: 'error',
      requestId,
      message: 'Speech request was invalid. Check the text and voice settings.',
    });
    return;
  }

  chrome.tts.stop();
  activeSpeech = { port, requestId };
  const speakOptions = {
    lang: options.language,
    rate: options.rate,
    pitch: options.pitch,
    volume: options.volume,
    enqueue: false,
    onEvent(event) {
      const speech = activeSpeech;
      if (speech?.port !== port || speech.requestId !== requestId) return;
      postToPort(port, { type: 'event', requestId, event });
      if (['end', 'interrupted', 'cancelled', 'error'].includes(event.type)) {
        activeSpeech = null;
      }
    },
  };
  if (options.voiceName) speakOptions.voiceName = options.voiceName;
  chrome.tts.speak(
    text.trim(),
    speakOptions,
    () => {
      const error = chrome.runtime.lastError;
      if (error && activeSpeech?.port === port && activeSpeech.requestId === requestId) {
        postToPort(port, {
          type: 'error',
          requestId,
          message: `Chrome could not start speech: ${error.message}`,
        });
        activeSpeech = null;
      }
    },
  );
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'eera-tts') return;

  port.onMessage.addListener((message) => handleTtsMessage(port, message));
  port.onDisconnect.addListener(() => {
    disconnectedPorts.add(port);
    if (activeSpeech?.port === port) {
      chrome.tts.stop();
      activeSpeech = null;
    }
  });
});

const microphoneSessionLeaseBroker = createMicrophoneSessionLeaseBroker();
chrome.runtime.onConnect.addListener((port) => {
  microphoneSessionLeaseBroker.handlePort(port);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'EERA_BROWSER_ACTION') return false;

  let properties;
  if (message.action === 'new-tab') {
    properties = {};
  } else if (message.action === 'open-youtube') {
    properties = { url: 'https://www.youtube.com/' };
  } else if (
    message.action === 'google-search' &&
    typeof message.query === 'string' &&
    message.query.trim() &&
    message.query.length <= 500
  ) {
    const url = new URL('https://www.google.com/search');
    url.searchParams.set('q', message.query.trim());
    properties = { url: url.toString() };
  } else {
    sendResponse({ ok: false, error: 'Unsupported browser action.' });
    return false;
  }

  chrome.tabs.create(properties, (tab) => {
    const error = chrome.runtime.lastError;
    if (error) {
      sendResponse({ ok: false, error: error.message });
      return;
    }
    sendResponse({ ok: Boolean(tab?.id), tabId: tab?.id });
  });
  return true;
});
