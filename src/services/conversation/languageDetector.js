const HINDI_SCRIPT = /[\u0900-\u097f]/u;
const HINGLISH_MARKERS = new Set([
  'aap',
  'acha',
  'achha',
  'accha',
  'hai',
  'hain',
  'ho',
  'hoon',
  'kaise',
  'kar',
  'karo',
  'karti',
  'kya',
  'main',
  'mein',
  'mujhe',
  'nahi',
  'nhi',
  'tum',
  'tumhe',
]);
const HINGLISH_PHRASE =
  /\b(?:kaise ho|kya haal|kya kar|mujhe bata|main theek|tum kya|aap kaise|shukriya|dhanyavaad|namaste eera|youtube kholo|youtube khol|naya tab|google par)\b/i;
const ENGLISH_ONLY = new Set([
  'a',
  'am',
  'an',
  'and',
  'are',
  'can',
  'do',
  'for',
  'hello',
  'hey',
  'hi',
  'i',
  'is',
  'it',
  'me',
  'my',
  'please',
  'tell',
  'thanks',
  'thank',
  'the',
  'to',
  'what',
  'who',
  'you',
  'your',
]);

export const CONVERSATION_LANGUAGES = Object.freeze([
  'en',
  'hi',
  'hinglish',
]);

export function detectConversationLanguage(
  text,
  { preferredLanguage = 'en-IN' } = {},
) {
  if (typeof text !== 'string' || !text.trim()) {
    return preferredLanguage === 'hi-IN' ? 'hi' : 'en';
  }
  if (HINDI_SCRIPT.test(text)) return 'hi';

  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const markers = new Set(words.filter((word) => HINGLISH_MARKERS.has(word)));
  if (HINGLISH_PHRASE.test(text) || markers.size >= 2) return 'hinglish';

  if (preferredLanguage === 'hi-IN' && words.length > 0) return 'hi';
  return 'en';
}

export function getSpeechLanguage(conversationLanguage, preferredLanguage = 'en-IN') {
  if (conversationLanguage === 'hi' || conversationLanguage === 'hinglish') {
    return 'hi-IN';
  }
  return preferredLanguage === 'en-US' ? 'en-US' : 'en-IN';
}
