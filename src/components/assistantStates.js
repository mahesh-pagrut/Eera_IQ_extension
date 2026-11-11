export const ASSISTANT_STATES = Object.freeze({
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  ERROR: 'error',
});

export const ASSISTANT_STATE_LABELS = Object.freeze({
  [ASSISTANT_STATES.IDLE]: 'Idle',
  [ASSISTANT_STATES.LISTENING]: 'Listening',
  [ASSISTANT_STATES.PROCESSING]: 'Processing',
  [ASSISTANT_STATES.SPEAKING]: 'Speaking',
  [ASSISTANT_STATES.ERROR]: 'Error',
});

export const ASSISTANT_STATE_STATUS = Object.freeze({
  [ASSISTANT_STATES.IDLE]: 'Ready to assist',
  [ASSISTANT_STATES.LISTENING]: 'Listening',
  [ASSISTANT_STATES.PROCESSING]: 'Thinking',
  [ASSISTANT_STATES.SPEAKING]: 'Speaking',
  [ASSISTANT_STATES.ERROR]: 'Something went wrong',
});
