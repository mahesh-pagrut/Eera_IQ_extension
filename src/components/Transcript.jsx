function Transcript({
  errorMessage,
  assistantName = 'Eera',
  hasConversation,
  onClearConversation,
  response,
  transcript,
}) {
  return (
    <div className="eera-transcript" aria-live="polite">
      <span className="eera-transcript__label">TRANSCRIPT</span>
      <p>{transcript || 'Waiting for your command...'}</p>
      {response && (
        <div className="eera-transcript__response" aria-live="polite">
          <span className="eera-transcript__label">{assistantName}</span>
          <p>{response}</p>
        </div>
      )}
      {errorMessage && (
        <p className="eera-transcript__error" role="alert">
          {errorMessage}
        </p>
      )}
      {hasConversation && (
        <button
          className="eera-clear-conversation"
          type="button"
          onClick={onClearConversation}
        >
          Clear conversation
        </button>
      )}
    </div>
  );
}

export default Transcript;
