function Transcript({ errorMessage, response, transcript }) {
  return (
    <div className="eera-transcript" aria-live="polite">
      <span className="eera-transcript__label">TRANSCRIPT</span>
      <p>{transcript || 'Waiting for your command...'}</p>
      {response && (
        <div className="eera-transcript__response" aria-live="polite">
          <span className="eera-transcript__label">EERA</span>
          <p>{response}</p>
        </div>
      )}
      {errorMessage && (
        <p className="eera-transcript__error" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export default Transcript;
