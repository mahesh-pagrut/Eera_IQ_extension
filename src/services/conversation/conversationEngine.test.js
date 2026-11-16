import assert from 'node:assert/strict';
import test from 'node:test';
import { createEeraIdentity } from '../../data/personality/eeraIdentity.js';
import { createConversationContext } from './conversationContext.js';
import { createConversationEngine } from './conversationEngine.js';
import {
  detectConversationLanguage,
  getSpeechLanguage,
} from './languageDetector.js';
import { createMessageRouter, createVoiceResponseHandler } from './messageRouter.js';
import { createResponseSelector } from './responseSelector.js';

function createDeterministicEngine(options = {}) {
  return createConversationEngine({
    selectResponse: createResponseSelector({ random: () => 0 }),
    ...options,
  });
}

test('responds to common conversational intents with short friendly responses', () => {
  const engine = createDeterministicEngine();
  for (const [message, expectedIntent] of [
    ['hello', 'greeting'],
    ['who are you?', 'introduction'],
    ['Are you human?', 'aboutAssistant'],
    ['How are you?', 'mood'],
    ['who created you?', 'creator'],
    ['what can you do?', 'capabilities'],
    ['thank you', 'thanks'],
    ['goodbye', 'farewell'],
    ["I'm sorry", 'apology'],
    ['I like the weather today', 'unknown'],
  ]) {
    const result = engine.respond(message);
    assert.equal(result.intent, expectedIntent);
    assert.ok(result.response.length < 240);
    assert.ok(result.speechLanguage);
  }
});

test('varies repeated responses and uses configurable identity and creator details', () => {
  const engine = createDeterministicEngine({
    identity: createEeraIdentity({
      creator: { name: 'Asha' },
      description: 'a thoughtful browser companion',
    }),
  });
  const firstGreeting = engine.respond('hello').response;
  const secondGreeting = engine.respond('hello').response;
  assert.notEqual(firstGreeting, secondGreeting);
  assert.match(engine.respond('Who are you?').response, /thoughtful browser companion/);
  assert.match(engine.respond('Who created you?').response, /Asha/);

  const unconfigured = createDeterministicEngine();
  assert.match(unconfigured.respond('Who created you?').response, /configured/);
});

test('detects Hindi script and Hinglish while avoiding a Hindi guess from a single borrowed word', () => {
  assert.equal(detectConversationLanguage('नमस्ते, आप कैसे हैं?'), 'hi');
  assert.equal(detectConversationLanguage('kya haal hai'), 'hinglish');
  assert.equal(detectConversationLanguage('what is namaste'), 'en');
  assert.equal(detectConversationLanguage('what is kya'), 'en');
  assert.equal(
    detectConversationLanguage('please help me', { preferredLanguage: 'hi-IN' }),
    'hi',
  );
  assert.equal(getSpeechLanguage('hinglish'), 'hi-IN');
  assert.equal(getSpeechLanguage('en', 'en-US'), 'en-US');
});

test('recognizes localized Hindi and Hinglish conversation intents', () => {
  const engine = createDeterministicEngine();
  for (const [message, intent] of [
    ['आप कौन हैं?', 'introduction'],
    ['क्या आप इंसान हैं?', 'aboutAssistant'],
    ['आप कैसी हैं?', 'mood'],
    ['तुम्हें किसने बनाया?', 'creator'],
    ['आप क्या कर सकती हैं?', 'capabilities'],
    ['धन्यवाद', 'thanks'],
    ['अलविदा', 'farewell'],
    ['माफ़ कीजिए', 'apology'],
    ['Hi Eera, kya haal hai?', 'greeting'],
  ]) {
    assert.equal(engine.respond(message).intent, intent, message);
  }
});

test('selects Hindi and Hinglish responses and speech language from the detected input', () => {
  const engine = createDeterministicEngine();
  const hindi = engine.respond('नमस्ते, आप कैसे हैं?');
  const hinglish = engine.respond('Hi Eera, kya haal hai?');
  assert.equal(hindi.language, 'hi');
  assert.match(hindi.response, /नमस्ते|नमस्कार|हाय/u);
  assert.equal(hindi.speechLanguage, 'hi-IN');
  assert.equal(hinglish.language, 'hinglish');
  assert.match(hinglish.response, /Main|Hi|Hey/u);
  assert.equal(hinglish.speechLanguage, 'hi-IN');
});

test('answers simple follow-ups using recent turns and returns the previous user question', () => {
  const engine = createDeterministicEngine();
  engine.respond('What can you do?');
  assert.match(engine.respond('Tell me more').response, /For example/u);

  engine.clear();
  engine.respond('Who are you?');
  assert.match(engine.respond('Tell me more').response, /friendly personal browser assistant/u);

  engine.clear();
  engine.respond('Can you help me?');
  assert.match(engine.respond('What did I ask?').response, /Can you help me/u);
});

test('conversation context is bounded, copied on read, and clearable without persistence', () => {
  let time = 0;
  const originalNow = Date.now;
  Date.now = () => ++time;
  try {
    const context = createConversationContext({ maxTurns: 2 });
    context.addTurn({ user: 'one', assistant: 'reply one', intent: 'x', language: 'en' });
    context.addTurn({ user: 'two', assistant: 'reply two', intent: 'x', language: 'en' });
    context.addTurn({ user: 'three', assistant: 'reply three', intent: 'x', language: 'en' });
    const turns = context.getRecentTurns();
    assert.deepEqual(turns.map((turn) => turn.user), ['two', 'three']);
    turns[0].user = 'mutated';
    assert.equal(context.getLastTurn().user, 'three');
    context.clear();
    assert.equal(context.size(), 0);
    assert.equal(context.getLastTurn(), null);
    assert.throws(() => context.addTurn({ user: ' ', assistant: 'reply' }));
  } finally {
    Date.now = originalNow;
  }
});

test('routes browser commands only to the command executor and conversations only to personality', async () => {
  const executed = [];
  const engine = createDeterministicEngine();
  const route = createMessageRouter({
    conversationEngine: engine,
    execute: async (command, options) => {
      executed.push({ command, options });
      return { response: 'Opening YouTube.' };
    },
  });

  const commandResult = await route('open YouTube');
  assert.equal(commandResult.source, 'command');
  assert.equal(commandResult.response, 'Opening YouTube.');
  assert.equal(executed.length, 1);
  assert.equal(executed[0].command.intent, 'open-youtube');
  assert.equal(engine.getRecentTurns().length, 1);

  const greetingResult = await route('hello');
  assert.equal(greetingResult.source, 'conversation');
  assert.equal(greetingResult.intent, 'greeting');
  assert.equal(executed.length, 1);

  const arbitraryResult = await route('please run some code');
  assert.equal(arbitraryResult.intent, 'unknown');
  assert.equal(executed.length, 1);
});

test('sends routed response and selected language into the existing speech callback', async () => {
  const engine = createDeterministicEngine();
  const route = createMessageRouter({ conversationEngine: engine });
  const spoken = [];
  const handleVoiceResponse = createVoiceResponseHandler({
    routeMessage: route,
    speak: async (text, options) => {
      spoken.push({ text, options });
      return true;
    },
  });

  const { result, speechStarted } = await handleVoiceResponse('नमस्ते');
  assert.equal(speechStarted, true);
  assert.equal(spoken[0].text, result.response);
  assert.deepEqual(spoken[0].options, { language: 'hi-IN' });
});
