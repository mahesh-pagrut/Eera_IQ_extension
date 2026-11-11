import AssistantStatus from './AssistantStatus.jsx';
import Transcript from './Transcript.jsx';

function EeraPanel({ isOpen }) {
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
          <h2 className="eera-panel__name">Eera</h2>
          <AssistantStatus />
        </div>
      </div>
      <p className="eera-panel__greeting">
        Hey! I&apos;m Eera. Your personal AI assistant. What can I help you with
        today?
      </p>
      <p className="eera-panel__voice-note">
        Voice interaction coming soon.
      </p>
      <Transcript />
    </section>
  );
}

export default EeraPanel;
