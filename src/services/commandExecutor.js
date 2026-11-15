const UNSUPPORTED_MESSAGE = Object.freeze({
  en: "I can't do that yet. I can tell the time, open YouTube, search Google, or open a new tab.",
  hi: 'मैं अभी यह काम नहीं कर सकती। मैं समय बता सकती हूँ, YouTube खोल सकती हूँ, Google पर खोज सकती हूँ, या नया टैब खोल सकती हूँ।',
});

function isHindi(language) {
  return language === 'hi-IN';
}

function browserActionMessage(intent, query) {
  if (intent === 'open-youtube') return { action: 'open-youtube' };
  if (intent === 'new-tab') return { action: 'new-tab' };
  if (intent === 'google-search') {
    return { action: 'google-search', query };
  }
  throw new RangeError(`Unsupported browser action: ${intent}`);
}

function tabPropertiesForAction(message) {
  if (message.action === 'new-tab') return {};
  if (message.action === 'open-youtube') {
    return { url: 'https://www.youtube.com/' };
  }
  if (message.action === 'google-search') {
    const url = new URL('https://www.google.com/search');
    url.searchParams.set('q', message.query);
    return { url: url.toString() };
  }
  return null;
}

function createTabDirectly(properties) {
  const chromeApi = globalThis.chrome;
  if (typeof chromeApi?.tabs?.create !== 'function') {
    return Promise.resolve({ ok: false });
  }

  return new Promise((resolve) => {
    chromeApi.tabs.create(properties, (tab) => {
      const error = chromeApi.runtime?.lastError;
      resolve(
        error
          ? { ok: false, error: error.message }
          : { ok: Boolean(tab?.id) },
      );
    });
  });
}

async function performBrowserAction(
  message,
  sendMessage,
  createTab = createTabDirectly,
) {
  if (typeof sendMessage === 'function') {
    try {
      const result = await sendMessage({
        type: 'EERA_BROWSER_ACTION',
        ...message,
      });
      if (result?.ok) return result;
    } catch {
      // The direct extension-page path below can still perform fixed tab actions.
    }
  }
  const properties = tabPropertiesForAction(message);
  if (!properties) return { ok: false };
  return createTab(properties);
}

export async function executeCommand(
  command,
  {
    language = 'en-IN',
    now = new Date(),
    sendMessage = globalThis.chrome?.runtime?.sendMessage?.bind(
      globalThis.chrome.runtime,
    ),
    createTab,
  } = {},
) {
  const hindi = isHindi(language);

  switch (command?.intent) {
    case 'greeting':
      return {
        response: hindi
          ? 'नमस्ते! मैं समय बता सकती हूँ, YouTube खोल सकती हूँ, Google पर खोज सकती हूँ, या नया टैब खोल सकती हूँ।'
          : "Hi! I'm Eera. I can tell the time, open YouTube, search Google, or open a new tab.",
      };
    case 'time':
      return {
        response: hindi
          ? `अभी ${now.toLocaleTimeString('hi-IN', { hour: 'numeric', minute: '2-digit' })} बजे हैं।`
          : `It's ${now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}.`,
      };
    case 'open-youtube': {
      const result = await performBrowserAction(
        browserActionMessage(command.intent),
        sendMessage,
        createTab,
      );
      return {
        response: result.ok
          ? hindi
            ? 'YouTube खोल रही हूँ।'
            : 'Opening YouTube.'
          : hindi
            ? 'मैं अभी YouTube नहीं खोल पाई। कृपया फिर से कोशिश करें।'
            : "I couldn't open YouTube. Please try again.",
      };
    }
    case 'new-tab': {
      const result = await performBrowserAction(
        browserActionMessage(command.intent),
        sendMessage,
        createTab,
      );
      return {
        response: result.ok
          ? hindi
            ? 'नया टैब खोल रही हूँ।'
            : 'Opening a new tab.'
          : hindi
            ? 'मैं नया टैब नहीं खोल पाई। कृपया फिर से कोशिश करें।'
            : "I couldn't open a new tab. Please try again.",
      };
    }
    case 'google-search': {
      const result = await performBrowserAction(
        browserActionMessage(command.intent, command.query),
        sendMessage,
        createTab,
      );
      return {
        response: result.ok
          ? hindi
            ? `Google पर ${command.query} खोज रही हूँ।`
            : `Searching Google for ${command.query}.`
          : hindi
            ? 'मैं Google खोज नहीं खोल पाई। कृपया फिर से कोशिश करें।'
            : "I couldn't open that Google search. Please try again.",
      };
    }
    default:
      return { response: hindi ? UNSUPPORTED_MESSAGE.hi : UNSUPPORTED_MESSAGE.en };
  }
}
