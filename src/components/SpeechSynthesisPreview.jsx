import { useState } from 'react';
import {
  SPEECH_LANGUAGES,
} from '../services/speechSynthesis.js';

const LANGUAGE_LABELS = Object.freeze({
  'en-IN': 'English (India)',
  'en-US': 'English (US)',
  'hi-IN': 'Hindi',
});

function SpeechSynthesisPreview({
  configuration,
  isSupported,
  onConfigure,
  onSelectVoice,
  onSpeak,
  onStop,
  status,
  voices,
  voiceURI,
}) {
  const [text, setText] = useState("Hey! I'm Eera. How can I help you?");

  function updateConfiguration(key, value) {
    onConfigure({ [key]: value });
  }

  return (
    <div className="eera-speech-preview">
      <label className="eera-dev-field">
        <span>Speech test</span>
        <textarea
          aria-label="Text for Eera to speak"
          rows="2"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <label className="eera-dev-field">
        <span>Language</span>
        <select
          aria-label="Speech language"
          value={configuration.language}
          onChange={(event) =>
            updateConfiguration('language', event.target.value)
          }
        >
          {SPEECH_LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {LANGUAGE_LABELS[language]} ({language})
            </option>
          ))}
        </select>
      </label>
      <label className="eera-dev-field">
        <span>Voice</span>
        <select
          aria-label="Speech voice"
          value={voiceURI}
          onChange={(event) => onSelectVoice(event.target.value)}
        >
          <option value="">Automatic preferred voice</option>
          {voices.map((voice) => (
            <option key={voice.voiceURI} value={voice.voiceURI}>
              {voice.name} — {voice.lang}
              {voice.default ? ' (default)' : ''}
            </option>
          ))}
        </select>
      </label>
      {[
        ['rate', 'Rate', 0.1, 2, 0.1],
        ['pitch', 'Pitch', 0, 2, 0.05],
        ['volume', 'Volume', 0, 1, 0.05],
      ].map(([key, label, min, max, step]) => (
        <label className="eera-dev-range" key={key}>
          <span>
            {label}: {configuration[key].toFixed(2)}
          </span>
          <input
            type="range"
            aria-label={`Speech ${label.toLowerCase()}`}
            min={min}
            max={max}
            step={step}
            value={configuration[key]}
            onChange={(event) =>
              updateConfiguration(key, Number(event.target.value))
            }
          />
        </label>
      ))}
      <div className="eera-speech-preview__actions">
        <button
          type="button"
          className="eera-listen-button"
          onClick={() => onSpeak(text, configuration)}
          disabled={!text.trim() || !isSupported}
        >
          Speak
        </button>
        <button
          type="button"
          className="eera-stop-speech-button"
          onClick={onStop}
          disabled={status !== 'starting' && status !== 'speaking'}
        >
          Stop speech
        </button>
      </div>
      <p className="eera-speech-preview__status" role="status">
        {status === 'unsupported'
          ? 'Speech synthesis is unavailable in this browser context.'
          : status === 'loading-voices' || voices.length === 0
            ? 'Waiting for browser voices…'
            : status === 'starting'
              ? 'Starting speech…'
              : status === 'speaking'
                ? 'Eera is speaking'
                : 'Voice playback is controlled by the browser.'}
      </p>
    </div>
  );
}

export default SpeechSynthesisPreview;
