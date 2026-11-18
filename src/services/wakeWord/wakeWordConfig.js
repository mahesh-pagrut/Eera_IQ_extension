export const DEFAULT_WAKE_WORD = 'Hey Eera';

export const DEFAULT_CONVERSATION_SESSION_CONFIG = Object.freeze({
  followUpWindowMs: 12_000,
  inactivityTimeoutMs: 60 * 60 * 1_000,
  maxRecoveryAttempts: 3,
  recoveryDelaysMs: Object.freeze([500, 1_500, 3_000]),
});
