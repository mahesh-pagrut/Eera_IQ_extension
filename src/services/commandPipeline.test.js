import assert from 'node:assert/strict';
import test from 'node:test';
import { executeCommand } from './commandExecutor.js';
import { parseCommand } from './commandParser.js';

test('parses the currently supported English, Hindi, and Hinglish requests', () => {
  assert.deepEqual(parseCommand('Hello Eera'), { intent: 'greeting' });
  assert.deepEqual(parseCommand('What time is it?'), { intent: 'time' });
  assert.deepEqual(parseCommand('अभी समय क्या है'), { intent: 'time' });
  assert.deepEqual(parseCommand('Open YouTube'), { intent: 'open-youtube' });
  assert.deepEqual(parseCommand('naya tab kholo'), { intent: 'new-tab' });
  assert.deepEqual(parseCommand('खोजो'), { intent: 'unsupported' });
  assert.deepEqual(parseCommand('Search Google for cats'), {
    intent: 'google-search',
    query: 'cats',
  });
  assert.deepEqual(parseCommand('Google पर cats search करो'), {
    intent: 'google-search',
    query: 'cats',
  });
  assert.deepEqual(parseCommand('please do something arbitrary'), {
    intent: 'unsupported',
  });
});

test('generates local greeting and time responses', async () => {
  const fixedTime = new Date('2025-02-01T13:05:00');
  assert.match(
    (await executeCommand({ intent: 'greeting' })).response,
    /I'm Eera/,
  );
  assert.match(
    (await executeCommand({ intent: 'time' }, { now: fixedTime })).response,
    /^It's 1:05/,
  );
  assert.match(
    (await executeCommand({ intent: 'time' }, { language: 'hi-IN', now: fixedTime }))
      .response,
    /बजे हैं/,
  );
});

test('only executes the explicit browser actions through the extension message bridge', async () => {
  const requests = [];
  const sendMessage = async (request) => {
    requests.push(request);
    return { ok: true };
  };

  assert.equal(
    (await executeCommand({ intent: 'open-youtube' }, { sendMessage })).response,
    'Opening YouTube.',
  );
  assert.equal(
    (
      await executeCommand(
        { intent: 'google-search', query: 'cats' },
        { sendMessage },
      )
    ).response,
    'Searching Google for cats.',
  );
  assert.deepEqual(requests, [
    { type: 'EERA_BROWSER_ACTION', action: 'open-youtube' },
    {
      type: 'EERA_BROWSER_ACTION',
      action: 'google-search',
      query: 'cats',
    },
  ]);
});

test('reports browser action failure rather than claiming success', async () => {
  const result = await executeCommand(
    { intent: 'new-tab' },
    { sendMessage: async () => ({ ok: false }) },
  );
  assert.equal(result.response, "I couldn't open a new tab. Please try again.");
});

test('uses the extension-page tab API when the service worker has no receiver', async () => {
  const openedTabs = [];
  const result = await executeCommand(
    { intent: 'open-youtube' },
    {
      sendMessage: async () => {
        throw new Error('Receiving end does not exist.');
      },
      createTab: async (properties) => {
        openedTabs.push(properties);
        return { ok: true };
      },
    },
  );
  assert.equal(result.response, 'Opening YouTube.');
  assert.deepEqual(openedTabs, [{ url: 'https://www.youtube.com/' }]);
});
