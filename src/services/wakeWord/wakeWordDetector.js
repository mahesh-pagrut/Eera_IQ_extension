import { DEFAULT_WAKE_WORD } from './wakeWordConfig.js';

function normalizeWords(text) {
  return String(text)
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

function wakeTokenMatches(actual, expected, isFinalToken) {
  if (actual === expected) return true;

  if (expected === 'hey' && ['हे', 'हाय'].includes(actual)) return true;
  if (
    expected === 'eera' &&
    ['era', 'erra', 'ईरा', 'एरा', 'इरा', 'एर्रा'].includes(actual)
  ) {
    return true;
  }
  if (!isFinalToken || expected.length < 4 || actual.length < 3) return false;

  let previousRow = Array.from({ length: actual.length + 1 }, (_, index) => index);
  for (let expectedIndex = 0; expectedIndex < expected.length; expectedIndex += 1) {
    const currentRow = [expectedIndex + 1];
    for (let actualIndex = 0; actualIndex < actual.length; actualIndex += 1) {
      currentRow.push(
        Math.min(
          currentRow[actualIndex] + 1,
          previousRow[actualIndex + 1] + 1,
          previousRow[actualIndex] +
            (expected[expectedIndex] === actual[actualIndex] ? 0 : 1),
        ),
      );
    }
    previousRow = currentRow;
  }
  return previousRow[actual.length] <= 1;
}

function getWakeWordVariants(wakeWords) {
  const isDefaultWakeWord =
    wakeWords.length === 2 &&
    wakeWords[0] === 'hey' &&
    wakeWords[1] === 'eera';
  return isDefaultWakeWord ? [wakeWords, ['here']] : [wakeWords];
}

export function detectWakeWord(
  transcript,
  phrase = DEFAULT_WAKE_WORD,
) {
  const words = normalizeWords(transcript);
  const wakeWords = normalizeWords(phrase);
  if (!wakeWords.length) {
    return { matched: false, remainder: '' };
  }

  for (const variant of getWakeWordVariants(wakeWords)) {
    if (words.length < variant.length) continue;

    for (let start = 0; start <= words.length - variant.length; start += 1) {
      if (variant.length === 1 && variant[0] === 'here' && start !== 0) {
        continue;
      }
      if (
        !variant.every((word, index) =>
          wakeTokenMatches(
            words[start + index],
            word,
            index === variant.length - 1,
          ),
        )
      ) {
        continue;
      }

      return {
        matched: true,
        remainder: words.slice(start + variant.length).join(' '),
      };
    }
  }

  return { matched: false, remainder: '' };
}
