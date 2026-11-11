import { useState } from 'react';
import AssistantStatePreview from './AssistantStatePreview.jsx';
import EeraOrb from './EeraOrb.jsx';
import EeraPanel from './EeraPanel.jsx';
import { ASSISTANT_STATES } from './assistantStates.js';

function EeraWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [assistantState, setAssistantState] = useState(ASSISTANT_STATES.IDLE);

  function togglePanel() {
    setIsOpen((open) => !open);
  }

  return (
    <div className="eera-widget">
      <EeraPanel assistantState={assistantState} isOpen={isOpen} />
      <EeraOrb
        assistantState={assistantState}
        isOpen={isOpen}
        onClick={togglePanel}
      />
      {import.meta.env.DEV && (
        <AssistantStatePreview
          assistantState={assistantState}
          onStateChange={setAssistantState}
        />
      )}
    </div>
  );
}

export default EeraWidget;
