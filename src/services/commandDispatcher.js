import {
  detectConversationLanguage,
  getSpeechLanguage,
} from './conversation/languageDetector.js';
import { isRecord, validateCommand } from './commandValidator.js';

function commandFailureResponse(intent, language) {
  if (intent === 'google-search') {
    return language === 'hi-IN'
      ? 'कृपया खोजने के लिए कुछ शब्द बताइए।'
      : 'Please tell me what you would like to search for.';
  }
  return language === 'hi-IN'
    ? 'मैं इस अनुरोध को समझ नहीं पाई। कृपया फिर से कहें।'
    : "I couldn't validate that command. Please try again.";
}

export function createCommandDispatcher({
  conversationEngine,
  handlers = {},
} = {}) {
  if (!conversationEngine || typeof conversationEngine.respond !== 'function') {
    throw new TypeError('Command dispatcher requires a conversation engine.');
  }

  const registry = new Map();
  for (const [intent, handler] of Object.entries(handlers)) {
    registerHandler(intent, handler);
  }

  function registerHandler(intent, handler) {
    if (typeof intent !== 'string' || !intent.trim()) {
      throw new TypeError('Command handler intent must be a non-empty string.');
    }
    if (
      !isRecord(handler) ||
      typeof handler.execute !== 'function' ||
      (handler.validateParameters !== undefined &&
        typeof handler.validateParameters !== 'function')
    ) {
      throw new TypeError(
        `Command handler "${intent}" must provide execute() and an optional validateParameters().`,
      );
    }
    if (registry.has(intent)) {
      throw new Error(`A command handler is already registered for "${intent}".`);
    }
    registry.set(intent, handler);
    return () => {
      if (registry.get(intent) === handler) registry.delete(intent);
    };
  }

  async function dispatch(
    parsedCommand,
    {
      text,
      preferredLanguage = 'en-IN',
      executeOptions = {},
    } = {},
  ) {
    const sourceText = typeof text === 'string' ? text : '';
    const language = detectConversationLanguage(sourceText, {
      preferredLanguage,
    });
    const speechLanguage = getSpeechLanguage(language, preferredLanguage);

    if (parsedCommand?.type === 'unsupported') {
      const result = conversationEngine.respond(sourceText, { preferredLanguage });
      return {
        ...result,
        type: 'result',
        source: 'conversation',
        ok: true,
      };
    }

    const intent =
      typeof parsedCommand?.intent === 'string' ? parsedCommand.intent : '';
    const handler = registry.get(intent);
    const validation = validateCommand(parsedCommand, handler);
    if (!validation.valid) {
      return {
        type: 'result',
        source: 'command',
        ok: false,
        intent: intent || undefined,
        language,
        speechLanguage,
        response:
          validation.code === 'invalid-parameters'
            ? validation.message
            : commandFailureResponse(intent, language),
        error: validation.message,
        errorCode: validation.code,
      };
    }

    let execution;
    try {
      execution = await handler.execute(parsedCommand.parameters, {
        ...executeOptions,
        intent,
        parameters: parsedCommand.parameters,
        language: speechLanguage,
        preferredLanguage,
        text: sourceText,
      });
      if (
        !isRecord(execution) ||
        typeof execution.response !== 'string' ||
        !execution.response.trim()
      ) {
        throw new TypeError(`Command handler "${intent}" returned no response.`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The command handler failed.';
      const response =
        language === 'hi-IN'
          ? 'कमांड पूरा नहीं हो पाया। कृपया फिर से कोशिश करें।'
          : 'I could not complete that command. Please try again.';
      conversationEngine.remember?.({
        user: sourceText,
        assistant: response,
        intent,
        language,
      });
      return {
        type: 'result',
        source: 'command',
        ok: false,
        intent,
        parameters: parsedCommand.parameters,
        response,
        language,
        speechLanguage,
        error: message,
        errorCode: 'handler-failed',
      };
    }

    conversationEngine.remember?.({
      user: sourceText,
      assistant: execution.response,
      intent,
      language,
    });
    return {
      type: 'result',
      source: 'command',
      ok: execution.ok !== false,
      intent,
      parameters: parsedCommand.parameters,
      response: execution.response,
      language,
      speechLanguage,
      ...(execution.error ? { error: execution.error } : {}),
    };
  }

  return {
    dispatch,
    registerHandler,
    getRegisteredIntents: () => [...registry.keys()],
  };
}
