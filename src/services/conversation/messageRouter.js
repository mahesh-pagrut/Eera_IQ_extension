import { parseCommand } from '../commandParser.js';
import { executeCommand } from '../commandExecutor.js';
import {
  detectConversationLanguage,
  getSpeechLanguage,
} from './languageDetector.js';

const EXECUTABLE_COMMANDS = new Set([
  'time',
  'new-tab',
  'open-youtube',
  'google-search',
]);

export function createMessageRouter({
  conversationEngine,
  parse = parseCommand,
  execute = executeCommand,
} = {}) {
  if (!conversationEngine || typeof conversationEngine.respond !== 'function') {
    throw new TypeError('Message router requires a conversation engine.');
  }

  return async function routeMessage(
    text,
    {
      preferredLanguage = 'en-IN',
      executeOptions = {},
    } = {},
  ) {
    const language = detectConversationLanguage(text, { preferredLanguage });
    const speechLanguage = getSpeechLanguage(language, preferredLanguage);
    const command = parse(text);

    if (EXECUTABLE_COMMANDS.has(command.intent)) {
      const { response } = await execute(command, {
        ...executeOptions,
        language: speechLanguage,
      });
      conversationEngine.remember({
        user: text,
        assistant: response,
        intent: command.intent,
        language,
      });
      return {
        response,
        intent: command.intent,
        language,
        speechLanguage,
        source: 'command',
      };
    }

    return {
      ...conversationEngine.respond(text, { preferredLanguage }),
      source: 'conversation',
    };
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
