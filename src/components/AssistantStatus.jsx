import { ASSISTANT_STATE_STATUS, ASSISTANT_STATES } from './assistantStates.js';

function AssistantStatus({ assistantState = ASSISTANT_STATES.IDLE }) {
  return (
    <div className="eera-status" role="status">
      <span
        className={`eera-status__dot eera-status__dot--${assistantState}`}
        aria-hidden="true"
      />
      <span>{ASSISTANT_STATE_STATUS[assistantState]}</span>
    </div>
  );
}

export default AssistantStatus;
