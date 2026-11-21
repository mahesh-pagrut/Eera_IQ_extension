import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommandDispatcher } from './commandDispatcher.js';
import { createConversationEngine } from './conversation/conversationEngine.js';
import {
  createMessageRouter,
  createVoiceResponseHandler,
} from './conversation/messageRouter.js';
import { parseCommand } from './commandParser.js';
import { createBrowserCommandHandlers } from './commands/browserCommandHandlers.js';

function createEngine() {
  const turns = [];
  return {
    turns,
    respond(text, options) {
      return {
        response: `Conversational response to: ${text}`,
        intent: 'unknown',
        language: options.preferredLanguage,
        speechLanguage: options.preferredLanguage,
      };
    },
    remember(turn) {
      turns.push(turn);
    },
  };
}

test('routes supported browser and local commands through registered handlers', async () => {
  const sentMessages = [];
  const engine = createEngine();
  const route = createMessageRouter({
    conversationEngine: engine,
    handlers: createBrowserCommandHandlers(),
  });
  const options = {
    executeOptions: {
      sendMessage: async (message) => {
        sentMessages.push(message);
        return { ok: true };
      },
      now: new Date('2025-02-01T13:05:00'),
    },
  };

  const youtube = await route('open YouTube', options);
  const google = await route('Search Google for Cats & Dogs', options);
  const combinedSearch = await route('open new tab and search cat', options);
  const time = await route('What time is it?', options);

  assert.deepEqual(
    [
      youtube.source,
      google.source,
      combinedSearch.source,
      time.source,
    ],
    ['command', 'command', 'command', 'command'],
  );
  assert.equal(youtube.ok, true);
  assert.equal(youtube.response, 'Opening YouTube.');
  assert.equal(google.response, 'Searching Google for Cats & Dogs.');
  assert.equal(combinedSearch.intent, 'google-search');
  assert.equal(combinedSearch.parameters.query, 'cat');
  assert.equal(combinedSearch.response, 'Searching Google for cat.');
  assert.match(time.response, /^It's 1:05/);
  assert.deepEqual(sentMessages, [
    { type: 'EERA_BROWSER_ACTION', action: 'open-youtube' },
    {
      type: 'EERA_BROWSER_ACTION',
      action: 'google-search',
      query: 'Cats & Dogs',
    },
    {
      type: 'EERA_BROWSER_ACTION',
      action: 'google-search',
      query: 'cat',
    },
  ]);
  assert.equal(engine.turns.length, 4);
});

test('routes unsupported conversational text to the existing conversation engine', async () => {
  const engine = createEngine();
  const route = createMessageRouter({ conversationEngine: engine });

  const result = await route('Hello Eera');

  assert.equal(result.source, 'conversation');
  assert.equal(result.response, 'Conversational response to: Hello Eera');
});

test('validates command shape and required search parameters before execution', async () => {
  const engine = createEngine();
  const executed = [];
  const dispatcher = createCommandDispatcher({
    conversationEngine: engine,
    handlers: {
      'google-search': {
        validateParameters: (parameters) => {
          if (Object.keys(parameters).some((key) => key !== 'query')) {
            return 'Unexpected search parameters.';
          }
          if (typeof parameters.query !== 'string' || !parameters.query.trim()) {
            return 'Tell me what you would like to search for.';
          }
          if (parameters.query.trim().length > 500) {
            return 'The search query is too long.';
          }
          return null;
        },
        async execute(parameters) {
          executed.push(parameters);
          return { ok: true, response: `Searching for ${parameters.query}.` };
        },
      },
    },
  });

  const parsed = parseCommand('Search Google for cats');
  const missingParameters = await dispatcher.dispatch(
    { ...parsed, parameters: undefined },
    { text: 'Search Google for cats' },
  );
  const emptyQuery = await dispatcher.dispatch(
    { ...parsed, parameters: { query: ' ' } },
    { text: 'Search Google for cats' },
  );
  const extraParameter = await dispatcher.dispatch(
    { ...parsed, parameters: { query: 'cats', url: 'javascript:alert(1)' } },
    { text: 'Search Google for cats' },
  );
  const tooLongQuery = await dispatcher.dispatch(
    { ...parsed, parameters: { query: 'a'.repeat(501) } },
    { text: 'Search Google for cats' },
  );
  const invalidRoot = await dispatcher.dispatch(
    { ...parsed, code: 'not executable' },
    { text: 'Search Google for cats' },
  );

  assert.equal(missingParameters.ok, false);
  assert.equal(missingParameters.errorCode, 'invalid-parameters');
  assert.equal(emptyQuery.ok, false);
  assert.equal(emptyQuery.errorCode, 'invalid-parameters');
  assert.equal(extraParameter.ok, false);
  assert.equal(extraParameter.errorCode, 'invalid-parameters');
  assert.equal(tooLongQuery.ok, false);
  assert.equal(tooLongQuery.errorCode, 'invalid-parameters');
  assert.equal(invalidRoot.ok, false);
  assert.equal(invalidRoot.errorCode, 'invalid-command');
  assert.deepEqual(executed, []);
});

test('reports command handler failures as an assistant response with error details', async () => {
  const route = createMessageRouter({
    conversationEngine: createEngine(),
    handlers: {
      'open-youtube': {
        validateParameters: () => null,
        async execute() {
          throw new Error('tab creation failed');
        },
      },
    },
  });

  const result = await route('open YouTube');

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'handler-failed');
  assert.equal(result.error, 'tab creation failed');
  assert.equal(result.response, 'I could not complete that command. Please try again.');
});

test('supports registering and unregistering a future command handler', async () => {
  const engine = createEngine();
  const dispatcher = createCommandDispatcher({ conversationEngine: engine });
  const removeHandler = dispatcher.registerHandler('sample-action', {
    validateParameters: (parameters) =>
      Object.keys(parameters).length ? 'Unexpected parameters.' : null,
    async execute() {
      return { ok: true, response: 'Sample action completed.' };
    },
  });
  const command = {
    type: 'command',
    intent: 'sample-action',
    parameters: {},
    confidence: 1,
    normalizedText: 'sample action',
  };

  assert.deepEqual(dispatcher.getRegisteredIntents(), ['sample-action']);
  assert.equal((await dispatcher.dispatch(command, { text: 'sample action' })).ok, true);
  removeHandler();
  const unsupported = await dispatcher.dispatch(command, { text: 'sample action' });
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.errorCode, 'unsupported-command');
  assert.deepEqual(dispatcher.getRegisteredIntents(), []);
});

test('passes a dispatched browser command response into the existing speech callback', async () => {
  const route = createMessageRouter({
    conversationEngine: createEngine(),
    handlers: createBrowserCommandHandlers(),
  });
  const spoken = [];
  const handleVoiceResponse = createVoiceResponseHandler({
    routeMessage: route,
    speak: async (text, options) => {
      spoken.push({ text, options });
      return true;
    },
  });

  const { result, speechStarted } = await handleVoiceResponse('open YouTube', {
    executeOptions: {
      sendMessage: async () => ({ ok: true }),
    },
  });

  assert.equal(result.source, 'command');
  assert.equal(speechStarted, true);
  assert.deepEqual(spoken, [
    { text: 'Opening YouTube.', options: { language: 'en-IN' } },
  ]);
});
