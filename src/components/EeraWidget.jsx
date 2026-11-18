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
import { createConversationEngine } from '../services/conversation/conversationEngine.js';
import {
  createMessageRouter,
  createVoiceResponseHandler,
} from '../services/conversation/messageRouter.js';
import { createConversationSessionManager } from '../services/conversationSessionManager.js';
import { createMicrophoneSessionLease } from '../services/microphoneSessionLease.js';
import { DEFAULT_CONVERSATION_SESSION_CONFIG } from '../services/wakeWord/wakeWordConfig.js';
import { EERA_IDENTITY } from '../data/personality/eeraIdentity.js';

function EeraWidget() {
  const conversationRef = useRef(null);
  if (!conversationRef.current) {
    const engine = createConversationEngine();
    const routeMessage = createMessageRouter({ conversationEngine: engine });
    conversationRef.current = {
      engine,
      handleMessage: createVoiceResponseHandler({
        routeMessage,
        speak: (text, options) => speak(text, options),
      }),
    };
  }
  const [isOpen, setIsOpen] = useState(false);
  const [recognitionStatus, setRecognitionStatus] = useState('idle');
  const [sessionState, setSessionState] = useState('inactive');
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
  const sessionManagerRef = useRef(null);
  const recognitionLanguageRef = useRef(language);
  const isMountedRef = useRef(false);
  recognitionLanguageRef.current = language;
  const speaking =
    synthesisStatus === 'starting' || synthesisStatus === 'speaking';
  const sessionOrbStates = {
    inactive: ASSISTANT_STATES.IDLE,
    acquiring: ASSISTANT_STATES.PROCESSING,
    'wake-word-standby': ASSISTANT_STATES.LISTENING,
    'command-listening': ASSISTANT_STATES.LISTENING,
    processing: ASSISTANT_STATES.PROCESSING,
    speaking: ASSISTANT_STATES.SPEAKING,
    'follow-up': ASSISTANT_STATES.LISTENING,
    'returning-to-standby': ASSISTANT_STATES.LISTENING,
    error: ASSISTANT_STATES.ERROR,
  };
  const actualAssistantState =
    synthesisStatus === 'error'
      ? ASSISTANT_STATES.ERROR
      : sessionOrbStates[sessionState] ?? ASSISTANT_STATES.IDLE;
  const assistantState =
    import.meta.env.DEV && previewState
      ? previewState
      : actualAssistantState;
  const isListening = recognitionStatus === 'listening';

  useEffect(() => {
    isMountedRef.current = true;
    const speechRecognition = createSpeechRecognitionService({
      language,
      continuous: true,
    });
    const speechSynthesis = createSpeechSynthesisService();
    const microphoneLease = createMicrophoneSessionLease();
    speechRecognitionRef.current = speechRecognition;
    speechSynthesisRef.current = speechSynthesis;
    setSynthesisSupported(speechSynthesis.isSupported());

    const sessionManager = createConversationSessionManager({
      recognition: speechRecognition,
      microphoneLease,
      followUpWindowMs:
        DEFAULT_CONVERSATION_SESSION_CONFIG.followUpWindowMs,
      inactivityTimeoutMs:
        DEFAULT_CONVERSATION_SESSION_CONFIG.inactivityTimeoutMs,
      onRequest: handleSessionRequest,
      onTranscript: ({ text }) => setTranscript(text),
      onStateChange: (nextState) => {
        setSessionState(nextState);
        if (nextState === 'inactive') {
          setIsOpen(false);
        } else if (nextState !== 'error') {
          setErrorMessage('');
        }
      },
      onError: (error) => {
        setErrorMessage(error.message);
      },
    });
    sessionManagerRef.current = sessionManager;
    const unsubscribeStatus = speechRecognition.onStatusChange((status) => {
      setRecognitionStatus(status);
    });
    const unsubscribeSynthesisStatus = speechSynthesis.onStatusChange(
      (status) => {
        setSynthesisStatus(status);
        sessionManager.handleSpeechStatus(status);
        if (status !== 'error') setErrorMessage('');
      },
    );
    const unsubscribeSynthesisError = speechSynthesis.onError((error) => {
      setErrorMessage(error.message);
    });
    const unsubscribeVoices = speechSynthesis.onVoicesChange((voices) => {
      setAvailableVoices(voices);
    }    );

    return () => {
      isMountedRef.current = false;
      unsubscribeStatus();
      unsubscribeVoices();
      unsubscribeSynthesisStatus();
      unsubscribeSynthesisError();
      sessionManager.dispose();
      speechSynthesis.dispose();
      speechRecognitionRef.current = null;
      speechSynthesisRef.current = null;
      sessionManagerRef.current = null;
    };
  }, []);

  async function handleSessionRequest(text) {
    if (!isMountedRef.current) return { speechStarted: false };
    try {
      const { result, speechStarted } =
        await conversationRef.current.handleMessage(text, {
          preferredLanguage: recognitionLanguageRef.current,
        });
      if (!isMountedRef.current) return { speechStarted: false };
      setResponse(result.response);
      return { speechStarted };
    } catch (error) {
      setErrorMessage(
        error.message || `${EERA_IDENTITY.name} could not process that request.`,
      );
      throw error;
    }
  }

  function handleOrbClick() {
    const sessionManager = sessionManagerRef.current;
    if (!isOpen || sessionState === 'error') {
      setIsOpen(true);
      setTranscript('');
      setResponse('');
      setErrorMessage('');
      if (sessionManager && !sessionManager.isActive()) {
        void sessionManager.activate();
      } else {
        sessionManager?.noteActivity();
      }
      return;
    }

    setIsOpen(false);
  }

  function clearConversation() {
    conversationRef.current.engine.clear();
    setTranscript('');
    setResponse('');
    setErrorMessage('');
    speechSynthesisRef.current?.stopSpeaking();
    void sessionManagerRef.current?.resetToWakeWordStandby();
  }

  function deactivateAssistant() {
    void sessionManagerRef.current?.deactivate('manual');
    speechSynthesisRef.current?.stopSpeaking();
  }

  async function handleLanguageChange(nextLanguage) {
    try {
      await sessionManagerRef.current?.setLanguage(nextLanguage);
      setLanguage(nextLanguage);
      recognitionLanguageRef.current = nextLanguage;
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function speak(text, overrides) {
    function startSpeech() {
      if (!isMountedRef.current) return false;
      setErrorMessage('');
      try {
        return speechSynthesisRef.current?.speak(text, overrides) ?? false;
      } catch (error) {
        setSynthesisStatus('error');
        setErrorMessage(error.message);
        return false;
      }
    }

    return Promise.resolve(sessionManagerRef.current?.pauseRecognition()).then(
      startSpeech,
    );
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
        identity={EERA_IDENTITY}
        errorMessage={errorMessage}
        isSpeaking={speaking}
        isSessionActive={sessionManagerRef.current?.isActive() ?? false}
        isOpen={isOpen}
        language={language}
        followUpSeconds={
          DEFAULT_CONVERSATION_SESSION_CONFIG.followUpWindowMs / 1_000
        }
        onLanguageChange={handleLanguageChange}
        onClearConversation={clearConversation}
        onDeactivateAssistant={deactivateAssistant}
        recognitionStatus={recognitionStatus}
        sessionState={sessionState}
        response={response}
        transcript={transcript}
      />
      <EeraOrb
        assistantName={EERA_IDENTITY.name}
        assistantState={assistantState}
        isOpen={isOpen}
        onClick={handleOrbClick}
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
