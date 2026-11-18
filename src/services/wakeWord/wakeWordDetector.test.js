import assert from 'node:assert/strict';
import test from 'node:test';
import { detectWakeWord } from './wakeWordDetector.js';

test('detects the configured wake phrase without case or punctuation sensitivity', () => {
  for (const transcript of [
    'Hey Eera',
    'hey eera',
    'Hey, Eera!',
    'HEY   EERA',
    'Please, hey Eera.',
  ]) {
    assert.equal(detectWakeWord(transcript).matched, true, transcript);
  }
});

test('returns only speech after the wake phrase as a possible request', () => {
  assert.deepEqual(detectWakeWord('Hey, Eera, what time is it?'), {
    matched: true,
    remainder: 'what time is it',
  });
  assert.deepEqual(detectWakeWord('Hey Eera'), {
    matched: true,
    remainder: '',
  });
});

test('matches common English and Hindi speech-recognition spellings of Eera', () => {
  for (const transcript of [
    'Hey Era',
    'Hey Erra, open YouTube',
    'Here open YouTube',
    'हे एरा, यूट्यूब खोलो',
    'हाय ईरा, यूट्यूब खोलो',
  ]) {
    assert.equal(detectWakeWord(transcript).matched, true, transcript);
  }

  assert.deepEqual(detectWakeWord('हे एरा, यूट्यूब खोलो'), {
    matched: true,
    remainder: 'यूट्यूब खोलो',
  });
  assert.deepEqual(detectWakeWord('Hey Erra, open YouTube'), {
    matched: true,
    remainder: 'open youtube',
  });
  assert.deepEqual(detectWakeWord('Here open YouTube'), {
    matched: true,
    remainder: 'open youtube',
  });
  assert.deepEqual(detectWakeWord('Here'), {
    matched: true,
    remainder: '',
  });
});

test('does not match unrelated speech or partial wake phrases', () => {
  for (const transcript of [
    'open YouTube',
    'Hey there',
    'Eera',
    'I heard an eerie sound',
    'Hey area',
    'Hey aura',
    'the video is here',
    'open YouTube here',
  ]) {
    assert.deepEqual(detectWakeWord(transcript), {
      matched: false,
      remainder: '',
    });
  }
});
