import assert from 'node:assert/strict';
import test from 'node:test';
import { createSpeechRecognitionService } from './speechRecognition.js';

class MockRecognition {
  constructor() {
    MockRecognition.instance = this;
    this.startCount = 0;
    this.abortCount = 0;
    this.stopCount = 0;
  }

  start() {
    this.startCount += 1;
  }

  abort() {
    this.abortCount += 1;
  }

  stop() {
    this.stopCount += 1;
  }
}

test('final transcripts enter processing and can be stopped cleanly before speech', async () => {
  const service = createSpeechRecognitionService({
    getRecognition: () => MockRecognition,
  });
  const transcripts = [];
  service.onTranscript((transcript) => transcripts.push(transcript));

  assert.equal(service.startListening(), true);
  const recognition = MockRecognition.instance;
  recognition.onstart();
  recognition.onresult({
    results: [{ isFinal: true, 0: { transcript: 'what time is it' } }],
  });

  assert.equal(service.getStatus(), 'processing');
  assert.deepEqual(transcripts, [
    { text: 'what time is it', isFinal: true },
  ]);

  const stopped = service.stopListening();
  assert.equal(recognition.stopCount, 1);
  recognition.onend();
  await stopped;
  assert.equal(service.getStatus(), 'idle');
  service.dispose();
});

test('does not re-emit an old final result as a new final when later interim text arrives', () => {
  const service = createSpeechRecognitionService({
    getRecognition: () => MockRecognition,
  });
  const transcripts = [];
  service.onTranscript((transcript) => transcripts.push(transcript));
  service.startListening();
  const recognition = MockRecognition.instance;
  recognition.onstart();
  recognition.onresult({
    resultIndex: 0,
    results: [{ isFinal: true, 0: { transcript: 'hello' } }],
  });
  recognition.onresult({
    resultIndex: 1,
    results: [
      { isFinal: true, 0: { transcript: 'hello' } },
      { isFinal: false, 0: { transcript: 'Eera' } },
    ],
  });

  assert.deepEqual(transcripts, [
    { text: 'hello', isFinal: true },
    { text: 'hello Eera', isFinal: false },
  ]);
  service.dispose();
});

test('explicit stop aborts active recognition and permission errors are readable', async () => {
  const service = createSpeechRecognitionService({
    getRecognition: () => MockRecognition,
  });
  service.startListening();
  const recognition = MockRecognition.instance;
  recognition.onstart();
  const stopped = service.stopListening();
  assert.equal(recognition.abortCount, 1);
  recognition.onend();
  await stopped;

  const errors = [];
  service.onError((error) => errors.push(error));
  service.startListening();
  MockRecognition.instance.onerror({ error: 'not-allowed' });
  assert.match(errors[0].message, /Microphone access was denied/);
  service.dispose();
});
