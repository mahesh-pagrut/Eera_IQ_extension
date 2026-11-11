import {
  ASSISTANT_STATE_LABELS,
  ASSISTANT_STATES,
} from './assistantStates.js';

const states = Object.values(ASSISTANT_STATES);

function AssistantStatePreview({ assistantState, onStateChange }) {
  return (
    <label className="eera-state-preview">
      <span>Animation preview</span>
      <select
        aria-label="Preview orb animation state"
        value={assistantState}
        onChange={(event) => onStateChange(event.target.value)}
      >
        {states.map((state) => (
          <option key={state} value={state}>
            {ASSISTANT_STATE_LABELS[state]}
          </option>
        ))}
      </select>
    </label>
  );
}

export default AssistantStatePreview;
