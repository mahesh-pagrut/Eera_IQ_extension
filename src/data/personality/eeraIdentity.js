export const EERA_IDENTITY = Object.freeze({
  name: 'Eera',
  description: 'a friendly personal browser assistant',
  creator: Object.freeze({
    name: '',
  }),
  defaultLanguage: 'en-IN',
  personalityTraits: Object.freeze([
    'friendly',
    'helpful',
    'curious',
    'respectful',
    'concise',
  ]),
  greetingStyles: Object.freeze(['warm', 'casual', 'polite']),
  responseTone: 'warm, conversational, and concise',
  capabilities: Object.freeze([
    'answer simple questions about herself',
    'tell the local time',
    'open YouTube',
    'search Google',
    'open a new browser tab',
  ]),
});

export function createEeraIdentity(overrides = {}) {
  return {
    ...EERA_IDENTITY,
    ...overrides,
    creator: {
      ...EERA_IDENTITY.creator,
      ...overrides.creator,
    },
    personalityTraits: [
      ...(overrides.personalityTraits ?? EERA_IDENTITY.personalityTraits),
    ],
    greetingStyles: [
      ...(overrides.greetingStyles ?? EERA_IDENTITY.greetingStyles),
    ],
    capabilities: [...(overrides.capabilities ?? EERA_IDENTITY.capabilities)],
  };
}
