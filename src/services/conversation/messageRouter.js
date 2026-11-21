import { createCommandDispatcher } from '../commandDispatcher.js';
import { parseCommand } from '../commandParser.js';
import { createBrowserCommandHandlers } from '../commands/browserCommandHandlers.js';

export function createMessageRouter({
  conversationEngine,
  parse = parseCommand,
  handlers = createBrowserCommandHandlers(),
  dispatcher,
} = {}) {
  const commandDispatcher =
    dispatcher ??
    createCommandDispatcher({
      conversationEngine,
      handlers,
    });
  if (typeof commandDispatcher.dispatch !== 'function') {
    throw new TypeError('Message router requires a command dispatcher.');
  }

  return async function routeMessage(
    text,
    {
      preferredLanguage = 'en-IN',
      executeOptions = {},
    } = {},
  ) {
    if (typeof text !== 'string' || !text.trim()) {
      throw new TypeError('Message router requires non-empty text.');
    }

    return commandDispatcher.dispatch(parse(text), {
      text,
      preferredLanguage,
      executeOptions,
    });
  };
}

export function createVoiceResponseHandler({ routeMessage, speak }) {
  if (typeof routeMessage !== 'function' || typeof speak !== 'function') {
    throw new TypeError(
      'Voice response handler requires routing and speech functions.',
    );
  }

  return async (text, options) => {
    const result = await routeMessage(text, options);
    const speechStarted = await speak(result.response, {
      language: result.speechLanguage,
    });
    return { result, speechStarted };
  };
}
