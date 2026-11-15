import { useEffect, useRef, useState } from 'react';
import AssistantStatePreview from './AssistantStatePreview.jsx';
import EeraOrb from './EeraOrb.jsx';
import EeraPanel from './EeraPanel.jsx';
import SpeechSynthesisPreview from './SpeechSynthesisPreview.jsx';
import { ASSISTANT_STATES } from './assistantStates.js';
import {
  createSpeechRecognitionService,
  DEFAULT_RECOGNITION_LANGUAGE,
} from '../services/speechRecognition.js';
import {
  createSpeechSynthesisService,
  DEFAULT_SPEECH_CONFIGURATION,
} from '../services/speechSynthesis.js';
import { parseCommand } from '../services/commandParser.js';
import { executeCommand } from '../services/commandExecutor.js';

function EeraWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [recognitionStatus, setRecognitionStatus] = useState('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [language, setLanguage] = useState(DEFAULT_RECOGNITION_LANGUAGE);
  const [previewState, setPreviewState] = useState(null);
  const [speechConfiguration, setSpeechConfiguration] = useState({
    ...DEFAULT_SPEECH_CONFIGURATION,
  });
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [synthesisStatus, setSynthesisStatus] = useState('idle');
  const [synthesisSupported, setSynthesisSupported] = useState(false);
  const speechRecognitionRef = useRef(null);
  const speechSynthesisRef = useRef(null);
  const recognitionStatusRef = useRef('idle');
  const recognitionLanguageRef = useRef(language);
  const isOpenRef = useRef(isOpen);
  const interactionGenerationRef = useRef(0);
  const lastRespondedTranscriptRef = useRef('');
  recognitionLanguageRef.current = language;
  isOpenRef.current = isOpen;
  const spokeDuringCurrentRecognitionRef = useRef(false);
  const speaking =
    synthesisStatus === 'starting' || synthesisStatus === 'speaking';
  let actualAssistantState = ASSISTANT_STATES.IDLE;
  if (synthesisStatus === 'error') {
    actualAssistantState = ASSISTANT_STATES.ERROR;
  } else if (speaking) {
    actualAssistantState = ASSISTANT_STATES.SPEAKING;
  } else if (recognitionStatus === 'error') {
    actualAssistantState = ASSISTANT_STATES.ERROR;
  } else if (recognitionStatus === 'listening') {
    actualAssistantState = ASSISTANT_STATES.LISTENING;
  } else if (recognitionStatus === 'processing' || isProcessing) {
    actualAssistantState = ASSISTANT_STATES.PROCESSING;
  }
  const assistantState =
    import.meta.env.DEV && previewState
      ? previewState
      : actualAssistantState;
  const isListening = recognitionStatus === 'listening';

  useEffect(() => {
    const speechRecognition = createSpeechRecognitionService({ language });
    const speechSynthesis = createSpeechSynthesisService();
    speechRecognitionRef.current = speechRecognition;
    speechSynthesisRef.current = speechSynthesis;
    setSynthesisSupported(speechSynthesis.isSupported());

    const unsubscribeTranscript = speechRecognition.onTranscript(
      ({ text, isFinal }) => {
        setTranscript(text);
        if (!isFinal || lastRespondedTranscriptRef.current === text) return;
        lastRespondedTranscriptRef.current = text;
        void handleFinalTranscript(text);
      },
    );
    const unsubscribeError = speechRecognition.onError((error) => {
      setErrorMessage(error.message);
    });
    const unsubscribeStatus = speechRecognition.onStatusChange((status) => {
      recognitionStatusRef.current = status;
      setRecognitionStatus(status);
      if (status !== 'error') setErrorMessage('');
    });
    const unsubscribeSynthesisStatus = speechSynthesis.onStatusChange(
      (status) => {
        setSynthesisStatus(status);
        if (status === 'speaking' || status === 'idle' || status === 'error') {
          setIsProcessing(false);
        }
        if (status === 'idle' && spokeDuringCurrentRecognitionRef.current) {
          spokeDuringCurrentRecognitionRef.current = false;
          if (recognitionStatusRef.current === 'processing') {
            recognitionStatusRef.current = 'idle';
            setRecognitionStatus('idle');
          }
        }
        if (status !== 'error') setErrorMessage('');
      },
    );
    const unsubscribeSynthesisError = speechSynthesis.onError((error) => {
      setErrorMessage(error.message);
    });
    const unsubscribeVoices = speechSynthesis.onVoicesChange((voices) => {
      setAvailableVoices(voices);
    });

    return () => {
      interactionGenerationRef.current += 1;
      unsubscribeTranscript();
      unsubscribeError();
      unsubscribeStatus();
      unsubscribeVoices();
      unsubscribeSynthesisStatus();
      unsubscribeSynthesisError();
      speechRecognition.dispose();
      speechSynthesis.dispose();
      speechRecognitionRef.current = null;
      speechSynthesisRef.current = null;
    };
  }, []);

  async function handleFinalTranscript(text) {
    const generation = interactionGenerationRef.current;
    setIsProcessing(true);
    try {
      await speechRecognitionRef.current?.stopListening();
      if (generation !== interactionGenerationRef.current || !isOpenRef.current) {
        return;
      }

      const command = parseCommand(text);
      const result = await executeCommand(command, {
        language: recognitionLanguageRef.current,
      });
      if (generation !== interactionGenerationRef.current || !isOpenRef.current) {
        return;
      }

      setResponse(result.response);
      const didStartSpeaking = await speak(result.response, {
        language: recognitionLanguageRef.current,
      });
      if (!didStartSpeaking) setIsProcessing(false);
    } catch (error) {
      if (generation === interactionGenerationRef.current) {
        setIsProcessing(false);
        setErrorMessage(error.message || 'Eera could not process that request.');
      }
    }
  }

  function togglePanel() {
    interactionGenerationRef.current += 1;
    if (isOpen) {
      isOpenRef.current = false;
      setIsProcessing(false);
      speechRecognitionRef.current?.stopListening();
      speechSynthesisRef.current?.stopSpeaking();
    } else {
      isOpenRef.current = true;
    }
    setIsOpen(!isOpen);
  }

  function toggleListening() {
    interactionGenerationRef.current += 1;
    setIsProcessing(false);
    const speechRecognition = speechRecognitionRef.current;
    if (!speechRecognition) return;
    if (isListening) {
      speechRecognition.stopListening();
      return;
    }

    if (['starting', 'speaking'].includes(synthesisStatus)) {
      speechSynthesisRef.current?.stopSpeaking();
    }
    if (synthesisStatus === 'error') setSynthesisStatus('idle');
    setTranscript('');
    setResponse('');
    setErrorMessage('');
    lastRespondedTranscriptRef.current = '';
    speechRecognition.startListening();
  }

  function handleLanguageChange(nextLanguage) {
    try {
      speechRecognitionRef.current?.setLanguage(nextLanguage);
      setLanguage(nextLanguage);
      recognitionLanguageRef.current = nextLanguage;
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function speak(text, overrides) {
    const recognition = speechRecognitionRef.current;
    const shouldStopRecognition = ['starting', 'listening'].includes(
      recognition?.getStatus(),
    );
    const recognitionWasProcessing =
      recognitionStatusRef.current === 'processing';

    function startSpeech() {
      setErrorMessage('');
      if (recognitionStatusRef.current === 'error') {
        recognitionStatusRef.current = 'idle';
        setRecognitionStatus('idle');
      }
      spokeDuringCurrentRecognitionRef.current = recognitionWasProcessing;
      try {
        return speechSynthesisRef.current?.speak(text, overrides) ?? false;
      } catch (error) {
        spokeDuringCurrentRecognitionRef.current = false;
        setSynthesisStatus('error');
        setErrorMessage(error.message);
        return false;
      }
    }

    if (shouldStopRecognition) {
      return recognition.stopListening().then(startSpeech);
    }
    return startSpeech();
  }

  function stopSpeaking() {
    speechSynthesisRef.current?.stopSpeaking();
  }

  function handleSpeechConfiguration(nextConfiguration) {
    try {
      const configuration =
        speechSynthesisRef.current?.configure(nextConfiguration);
      if (configuration) setSpeechConfiguration(configuration);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function handleVoiceSelection(voiceURI) {
    try {
      speechSynthesisRef.current?.setPreferredVoice(voiceURI || null);
      setSelectedVoiceURI(voiceURI);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  const devSpeechControls = import.meta.env.DEV ? (
    <SpeechSynthesisPreview
      configuration={speechConfiguration}
      isSupported={synthesisSupported}
      onConfigure={handleSpeechConfiguration}
      onSelectVoice={handleVoiceSelection}
      onSpeak={speak}
      onStop={stopSpeaking}
      status={synthesisSupported ? synthesisStatus : 'unsupported'}
      voices={availableVoices}
      voiceURI={selectedVoiceURI}
    />
  ) : null;

  return (
    <div className="eera-widget">
      <EeraPanel
        assistantState={assistantState}
        devSpeechControls={devSpeechControls}
        errorMessage={errorMessage}
        isListening={isListening}
        isSpeaking={speaking}
        isOpen={isOpen}
        language={language}
        onLanguageChange={handleLanguageChange}
        onToggleListening={toggleListening}
        recognitionStatus={recognitionStatus}
        response={response}
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
