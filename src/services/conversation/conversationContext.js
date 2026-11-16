export function createConversationContext({ maxTurns = 8 } = {}) {
  if (!Number.isInteger(maxTurns) || maxTurns < 1) {
    throw new RangeError('Conversation context maxTurns must be a positive integer.');
  }

  let turns = [];

  function addTurn({ user, assistant, intent, language }) {
    if (typeof user !== 'string' || !user.trim()) {
      throw new TypeError('Conversation user message must be a non-empty string.');
    }
    if (typeof assistant !== 'string' || !assistant.trim()) {
      throw new TypeError('Conversation assistant response must be a non-empty string.');
    }

    turns = [
      ...turns,
      {
        user: user.trim(),
        assistant: assistant.trim(),
        intent,
        language,
        timestamp: Date.now(),
      },
    ].slice(-maxTurns);
  }

  return {
    addTurn,
    getRecentTurns: (count = maxTurns) =>
      turns.slice(-count).map((turn) => ({ ...turn })),
    getLastTurn: () => (turns.length ? { ...turns.at(-1) } : null),
    clear: () => {
      turns = [];
    },
    size: () => turns.length,
  };
}
