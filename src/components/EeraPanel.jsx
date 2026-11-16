import AssistantStatus from './AssistantStatus.jsx';
import Transcript from './Transcript.jsx';
import {
  DEFAULT_RECOGNITION_LANGUAGE,
  SUPPORTED_RECOGNITION_LANGUAGES,
} from '../services/speechRecognition.js';

const LANGUAGE_LABELS = Object.freeze({
  'en-IN': 'English (India)',
  'en-US': 'English (US)',
  'hi-IN': 'Hindi / Hinglish (Hindi recognition)',
});

function EeraPanel({
  assistantState,
  errorMessage,
  isListening,
  isSpeaking,
  devSpeechControls,
  identity,
  isOpen,
  language = DEFAULT_RECOGNITION_LANGUAGE,
  onLanguageChange,
  onClearConversation,
  onToggleListening,
  recognitionStatus,
  response,
  transcript,
}) {
  return (
    <section
      id="eera-assistant-panel"
      className="eera-panel"
      aria-label="Eera assistant"
      hidden={!isOpen}
    >
      <div className="eera-panel__heading">
        <div className="eera-panel__avatar" aria-hidden="true">
          E
        </div>
        <div>
          <h2 className="eera-panel__name">{identity.name}</h2>
          <AssistantStatus
            assistantState={assistantState}
            recognitionStatus={recognitionStatus}
          />
        </div>
      </div>
      <p className="eera-panel__greeting">
        Hey! I&apos;m {identity.name}, {identity.description}. What can I help
        you with today?
      </p>
      <p className="eera-panel__voice-note">
        Microphone starts only when you choose Listen. Chrome may use an online
        speech service; {identity.name} does not save audio. Speech output uses browser
        voices.
      </p>
      <label className="eera-language">
        <span>Recognition language</span>
        <select
          value={language}
          onChange={(event) => onLanguageChange(event.target.value)}
          disabled={
            isListening ||
            isSpeaking ||
            recognitionStatus === 'starting' ||
            recognitionStatus === 'stopping'
          }
        >
          {SUPPORTED_RECOGNITION_LANGUAGES.map((supportedLanguage) => (
            <option key={supportedLanguage} value={supportedLanguage}>
              {LANGUAGE_LABELS[supportedLanguage]}
            </option>
          ))}
        </select>
      </label>
      <button
        className="eera-listen-button"
        type="button"
        onClick={onToggleListening}
        disabled={
          recognitionStatus === 'starting' || recognitionStatus === 'stopping'
        }
      >
        {isListening ? 'Stop listening' : 'Listen'}
      </button>
      <Transcript
        errorMessage={errorMessage}
        assistantName={identity.name}
        hasConversation={Boolean(transcript || response)}
        onClearConversation={onClearConversation}
        response={response}
        transcript={transcript}
      />
      {devSpeechControls}
    </section>
  );
}

export default EeraPanel;
