import { ASSISTANT_STATE_STATUS, ASSISTANT_STATES } from './assistantStates.js';

function AssistantStatus({
  assistantState = ASSISTANT_STATES.IDLE,
  recognitionStatus = 'idle',
  sessionState = 'inactive',
  followUpSeconds = 12,
}) {
  const sessionLabels = {
    inactive: 'Inactive — tap orb to activate',
    acquiring: 'Activating Eera',
    'wake-word-standby': 'Say “Hey Eera”',
    'command-listening': 'Listening for your request',
    processing: 'Thinking',
    speaking: 'Speaking',
    'follow-up': `You can speak for ${followUpSeconds} seconds`,
    'returning-to-standby': 'Returning to wake-word standby',
    error: 'Assistant needs attention',
  };
  const statusText =
    {
      starting: 'Requesting microphone',
      stopping: 'Stopping microphone',
    }[recognitionStatus] ??
    sessionLabels[sessionState] ??
    ASSISTANT_STATE_STATUS[assistantState];

  return (
    <div className="eera-status" role="status">
      <span
        className={`eera-status__dot eera-status__dot--${assistantState}`}
        aria-hidden="true"
      />
      <span>{statusText}</span>
    </div>
  );
}

export default AssistantStatus;
