const GREETING_PATTERN =
  /^(?:hi|hello|hey|namaste|नमस्ते|नमस्कार)(?:\s+eera)?[.! ]*$/iu;
const TIME_PATTERN =
  /\b(?:what(?:'s| is) the time|what time is it|tell me the time|current time|time now|abhi time kya hai|abhi kitne baje)\b|समय क्या है|कितने बजे|टाइम क्या हुआ|अभी समय/u;
const NEW_TAB_PATTERN =
  /\b(?:open|create|start)\s+(?:a\s+)?new tab\b|naya tab kholo|naya tab|नया टैब|नई टैब/u;
const YOUTUBE_PATTERN =
  /\b(?:open|launch|go to|start)\s+(?:the\s+)?youtube\b|youtube kholo|youtube khol|यूट्यूब खोलो|यूट्यूब खोल/u;
const SEARCH_PATTERNS = [
  /google\s+पर\s+(.+?)\s+(?:search|खोजो|ढूँढो|ढूंढो)/iu,
  /गूगल\s+पर\s+(.+?)\s+(?:खोजो|ढूँढो|ढूंढो)/u,
  /\b(?:search(?:\s+google)?\s+for|google\s+search\s+for|find)\s+(.+)$/iu,
  /\bgoogle\s+(.+)$/iu,
];

export function parseCommand(transcript) {
  if (typeof transcript !== 'string' || !transcript.trim()) {
    return { intent: 'unsupported' };
  }

  const text = transcript.trim();
  const normalized = text.toLocaleLowerCase();

  if (GREETING_PATTERN.test(normalized)) return { intent: 'greeting' };
  if (TIME_PATTERN.test(normalized)) return { intent: 'time' };
  if (NEW_TAB_PATTERN.test(normalized)) return { intent: 'new-tab' };
  if (YOUTUBE_PATTERN.test(normalized)) return { intent: 'open-youtube' };

  for (const pattern of SEARCH_PATTERNS) {
    const match = normalized.match(pattern);
    const query = match?.[1]?.trim().replace(/[.!?]+$/, '');
    if (query) return { intent: 'google-search', query };
  }

  return { intent: 'unsupported' };
}
