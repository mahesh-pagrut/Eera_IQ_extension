function EeraOrb({ isOpen, onClick }) {
  return (
    <button
      type="button"
      className="eera-orb"
      aria-label={isOpen ? 'Close Eera assistant' : 'Open Eera assistant'}
      aria-expanded={isOpen}
      aria-controls="eera-assistant-panel"
      onClick={onClick}
    >
      <span className="eera-orb__core" aria-hidden="true">
        <svg viewBox="0 0 32 32" focusable="false">
          <path
            d="M16 5.5 18.7 13l7.8 3-7.8 3L16 26.5 13.3 19l-7.8-3 7.8-3L16 5.5Z"
            fill="currentColor"
          />
          <circle cx="24.5" cy="8" r="1.5" fill="currentColor" />
        </svg>
      </span>
    </button>
  );
}

export default EeraOrb;
