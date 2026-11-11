import { ASSISTANT_STATE_STATUS, ASSISTANT_STATES } from './assistantStates.js';

function AssistantStatus({
  assistantState = ASSISTANT_STATES.IDLE,
  recognitionStatus = 'idle',
}) {
  const statusText = {
    starting: 'Requesting microphone',
    stopping: 'Stopping microphone',
  }[recognitionStatus] ?? ASSISTANT_STATE_STATUS[assistantState];

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
