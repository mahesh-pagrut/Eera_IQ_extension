import { useEffect, useRef, useState } from 'react';
import AssistantStatePreview from './AssistantStatePreview.jsx';
import EeraOrb from './EeraOrb.jsx';
import EeraPanel from './EeraPanel.jsx';
import { ASSISTANT_STATES } from './assistantStates.js';
import {
  createSpeechRecognitionService,
  DEFAULT_RECOGNITION_LANGUAGE,
} from '../services/speechRecognition.js';

function EeraWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [recognitionStatus, setRecognitionStatus] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [language, setLanguage] = useState(DEFAULT_RECOGNITION_LANGUAGE);
  const [previewState, setPreviewState] = useState(null);
  const speechRecognitionRef = useRef(null);
  const actualAssistantState =
    recognitionStatus === 'listening'
      ? ASSISTANT_STATES.LISTENING
      : recognitionStatus === 'processing'
        ? ASSISTANT_STATES.PROCESSING
        : recognitionStatus === 'error'
          ? ASSISTANT_STATES.ERROR
          : ASSISTANT_STATES.IDLE;
  const assistantState =
    import.meta.env.DEV && previewState ? previewState : actualAssistantState;
  const isListening = recognitionStatus === 'listening';

  useEffect(() => {
    const speechRecognition = createSpeechRecognitionService({ language });
    speechRecognitionRef.current = speechRecognition;
    const unsubscribeTranscript = speechRecognition.onTranscript(
      ({ text }) => setTranscript(text),
    );
    const unsubscribeError = speechRecognition.onError((error) => {
      setErrorMessage(error.message);
    });
    const unsubscribeStatus = speechRecognition.onStatusChange((status) => {
      setRecognitionStatus(status);
      if (status !== 'error') setErrorMessage('');
    });

    return () => {
      unsubscribeTranscript();
      unsubscribeError();
      unsubscribeStatus();
      speechRecognition.dispose();
      speechRecognitionRef.current = null;
    };
  }, []);

  function togglePanel() {
    if (isOpen) speechRecognitionRef.current?.stopListening();
    setIsOpen((open) => !open);
  }

  function toggleListening() {
    const speechRecognition = speechRecognitionRef.current;
    if (!speechRecognition) return;
    if (isListening) {
      speechRecognition.stopListening();
      return;
    }

    setTranscript('');
    setErrorMessage('');
    speechRecognition.startListening();
  }

  function handleLanguageChange(nextLanguage) {
    try {
      speechRecognitionRef.current?.setLanguage(nextLanguage);
      setLanguage(nextLanguage);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  return (
    <div className="eera-widget">
      <EeraPanel
        assistantState={assistantState}
        errorMessage={errorMessage}
        isListening={isListening}
        isOpen={isOpen}
        language={language}
        onLanguageChange={handleLanguageChange}
        onToggleListening={toggleListening}
        recognitionStatus={recognitionStatus}
        transcript={transcript}
      />
      <EeraOrb
        assistantState={assistantState}
        isOpen={isOpen}
        onClick={togglePanel}
      />
      {import.meta.env.DEV && (
        <AssistantStatePreview
          assistantState={previewState}
          onStateChange={setPreviewState}
        />
      )}
    </div>
  );
}

export default EeraWidget;
