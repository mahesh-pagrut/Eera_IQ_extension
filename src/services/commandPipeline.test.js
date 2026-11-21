import assert from 'node:assert/strict';
import test from 'node:test';
import { executeCommand } from './commandExecutor.js';
import { parseCommand } from './commandParser.js';

function expectCommand(text, intent, parameters = {}) {
  const parsed = parseCommand(text);
  assert.equal(parsed.type, 'command');
  assert.equal(parsed.intent, intent);
  assert.deepEqual(parsed.parameters, parameters);
  assert.equal(parsed.confidence, 1);
  assert.equal(typeof parsed.normalizedText, 'string');
  return parsed;
}

test('normalizes and parses supported English, Hindi, and Hinglish requests', () => {
  expectCommand('  WHAT time is it?! ', 'time');
  expectCommand('अभी समय क्या है', 'time');
  expectCommand('Open YouTube', 'open-youtube');
  expectCommand('please go to the YouTube', 'open-youtube');
  expectCommand('naya tab kholo', 'new-tab');
  expectCommand('नई टैब खोलो', 'new-tab');
  expectCommand('Search Google for cats', 'google-search', { query: 'cats' });
  expectCommand('Google पर cats search करो', 'google-search', { query: 'cats' });
  expectCommand('open new tab and search cat', 'google-search', {
    query: 'cat',
  });
  expectCommand('create a new tab then search Google for cats', 'google-search', {
    query: 'cats',
  });
  expectCommand('find Cats & Dogs on Google', 'google-search', {
    query: 'Cats & Dogs',
  });
});

test('routes greetings and unknown text away from browser command parsing', () => {
  for (const text of [
    'Hello Eera',
    'What can you do?',
    'please do something arbitrary',
    '',
    null,
  ]) {
    const parsed = parseCommand(text);
    assert.equal(parsed.type, 'unsupported');
    assert.equal(parsed.confidence, 0);
    assert.equal(typeof parsed.normalizedText, 'string');
  }
});

test('generates local greeting and time responses', async () => {
  const fixedTime = new Date('2025-02-01T13:05:00');
  assert.match(
    (await executeCommand(expectCommand('What time is it?', 'time'), { now: fixedTime })).response,
    /^It's 1:05/,
  );
  assert.match(
    (await executeCommand(expectCommand('अभी समय क्या है', 'time'), { language: 'hi-IN', now: fixedTime }))
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
    (await executeCommand(expectCommand('open YouTube', 'open-youtube'), { sendMessage })).response,
    'Opening YouTube.',
  );
  assert.equal(
    (
      await executeCommand(
        expectCommand('Search Google for cats', 'google-search', { query: 'cats' }),
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
    expectCommand('open a new tab', 'new-tab'),
    { sendMessage: async () => ({ ok: false }) },
  );
  assert.equal(result.response, "I couldn't open a new tab. Please try again.");
});

test('uses the extension-page tab API when the service worker has no receiver', async () => {
  const openedTabs = [];
  const result = await executeCommand(
    expectCommand('open YouTube', 'open-youtube'),
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

test('keeps Google search input inside the fixed Google query URL', async () => {
  const openedTabs = [];
  const result = await executeCommand(
    expectCommand('Search Google for https://example.com', 'google-search', {
      query: 'https://example.com',
    }),
    {
      sendMessage: async () => {
        throw new Error('No worker receiver.');
      },
      createTab: async (properties) => {
        openedTabs.push(properties);
        return { ok: true };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(openedTabs.length, 1);
  assert.equal(
    new URL(openedTabs[0].url).origin,
    'https://www.google.com',
  );
  assert.equal(
    new URL(openedTabs[0].url).searchParams.get('q'),
    'https://example.com',
  );
});

test('uses the extension runtime message bridge by default for website browser actions', async () => {
  const previousChrome = globalThis.chrome;
  const requests = [];
  globalThis.chrome = {
    runtime: {
      async sendMessage(message) {
        requests.push(message);
        return { ok: true, tabId: 42 };
      },
    },
  };

  try {
    const result = await executeCommand(
      expectCommand('open a new tab', 'new-tab'),
    );

    assert.equal(result.ok, true);
    assert.equal(result.response, 'Opening a new tab.');
    assert.deepEqual(requests, [
      { type: 'EERA_BROWSER_ACTION', action: 'new-tab' },
    ]);
  } finally {
    if (previousChrome === undefined) {
      delete globalThis.chrome;
    } else {
      globalThis.chrome = previousChrome;
    }
  }
});
