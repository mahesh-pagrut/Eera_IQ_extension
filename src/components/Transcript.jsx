function Transcript({ errorMessage, transcript }) {
  return (
    <div className="eera-transcript" aria-live="polite">
      <span className="eera-transcript__label">TRANSCRIPT</span>
      <p>{transcript || 'Waiting for your command...'}</p>
      {errorMessage && (
        <p className="eera-transcript__error" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export default Transcript;
