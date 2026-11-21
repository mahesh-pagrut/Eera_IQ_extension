function normalizeCommandText(input) {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s'’]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

const TIME_PATTERN =
  /\b(?:what(?:'s| is) (?:the )?time|what time is it|tell me the time|current time|time now|time please|abhi time kya hai|abhi kitne baje)\b|समय क्या है|कितने बजे|टाइम क्या हुआ|अभी समय/u;
const NEW_TAB_PATTERN =
  /\b(?:open|create|start) (?:a )?new tab\b|\bnaya tab(?: kholo)?\b|नया टैब(?: खोलो)?|नई टैब(?: खोलो)?/u;
const NEW_TAB_SEARCH_PATTERN =
  /^(?:please )?(?:open|create|start) (?:a )?new tab (?:and|then) search(?: google)?(?: for)? (.+)$/u;
const YOUTUBE_PATTERN =
  /\b(?:open|launch|go to|start) (?:the )?youtube\b|\byoutube (?:kholo|khol)\b|यूट्यूब खोलो|यूट्यूब खोल/u;
const SEARCH_PATTERNS = [
  /google\s+पर\s+(.+?)\s+(?:search|खोजो|ढूँढो|ढूंढो)/iu,
  /गूगल\s+पर\s+(.+?)\s+(?:खोजो|ढूँढो|ढूंढो)/u,
  /\bsearch\s+(.+?)\s+(?:on|in)\s+google\b/iu,
  /\bfind\s+(.+?)\s+(?:on|in)\s+google\b/iu,
  /\b(?:search(?:\s+google)?\s+for|google\s+search\s+for|find)\s+(.+)$/iu,
  /\bgoogle\s+(.+)$/iu,
];

function command(intent, parameters, normalizedText) {
  return {
    type: 'command',
    intent,
    parameters,
    confidence: 1,
    normalizedText,
  };
}

function cleanQuery(query) {
  return query.trim().replace(/[.!?]+$/u, '').trim();
}

export function parseCommand(input) {
  if (typeof input !== 'string') {
    return {
      type: 'unsupported',
      normalizedText: '',
      confidence: 0,
    };
  }

  const normalizedText = normalizeCommandText(input);
  if (!normalizedText) {
    return {
      type: 'unsupported',
      normalizedText,
      confidence: 0,
    };
  }

  const newTabSearch = normalizedText.match(NEW_TAB_SEARCH_PATTERN);
  if (newTabSearch) {
    const query = cleanQuery(newTabSearch[1]);
    if (query) {
      return command('google-search', { query }, normalizedText);
    }
  }

  if (TIME_PATTERN.test(normalizedText)) {
    return command('time', {}, normalizedText);
  }
  if (NEW_TAB_PATTERN.test(normalizedText)) {
    return command('new-tab', {}, normalizedText);
  }
  if (YOUTUBE_PATTERN.test(normalizedText)) {
    return command('open-youtube', {}, normalizedText);
  }

  for (const pattern of SEARCH_PATTERNS) {
    const match = input.normalize('NFKC').match(pattern);
    const query = match?.[1] ? cleanQuery(match[1]) : '';
    if (query) {
      return command('google-search', { query }, normalizedText);
    }
  }

  return {
    type: 'unsupported',
    normalizedText,
    confidence: 0,
  };
}

export { normalizeCommandText };
