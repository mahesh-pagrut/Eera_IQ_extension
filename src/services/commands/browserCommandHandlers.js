function isHindi(language) {
  return language === 'hi-IN';
}

function isEmptyParameters(parameters) {
  return Object.keys(parameters).length === 0
    ? null
    : 'That command does not accept extra parameters.';
}

function queryParameterError(parameters) {
  if (Object.keys(parameters).some((key) => key !== 'query')) {
    return 'The search request contains unsupported parameters.';
  }
  if (typeof parameters.query !== 'string' || !parameters.query.trim()) {
    return 'Tell me what you would like to search for.';
  }
  if (parameters.query.trim().length > 500) {
    return 'That search query is too long. Please keep it under 500 characters.';
  }
  return null;
}

function browserActionMessage(intent, parameters = {}) {
  if (intent === 'open-youtube') return { action: 'open-youtube' };
  if (intent === 'new-tab') return { action: 'new-tab' };
  if (intent === 'google-search') {
    return { action: 'google-search', query: parameters.query.trim() };
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
    return Promise.resolve({
      ok: false,
      error: 'The Chrome tabs API is unavailable in this context.',
    });
  }

  return new Promise((resolve) => {
    chromeApi.tabs.create(properties, (tab) => {
      const error = chromeApi.runtime?.lastError;
      resolve(
        error
          ? { ok: false, error: error.message }
          : {
              ok: Boolean(tab?.id),
              error: tab?.id ? undefined : 'Chrome did not create a tab.',
            },
      );
    });
  });
}

function getRuntimeMessageSender() {
  const runtime = globalThis.chrome?.runtime;
  return typeof runtime?.sendMessage === 'function'
    ? runtime.sendMessage.bind(runtime)
    : undefined;
}

async function performBrowserAction(
  message,
  {
    sendMessage = getRuntimeMessageSender(),
    createTab = createTabDirectly,
  } = {},
) {
  let bridgeError = '';
  if (typeof sendMessage === 'function') {
    try {
      const result = await sendMessage({
        type: 'EERA_BROWSER_ACTION',
        ...message,
      });
      if (result?.ok) return result;
      bridgeError = result?.error ?? '';
    } catch (error) {
      bridgeError = error instanceof Error ? error.message : String(error);
    }
  }

  const properties = tabPropertiesForAction(message);
  if (!properties) {
    return { ok: false, error: bridgeError || 'The browser action was invalid.' };
  }
  const result = await createTab(properties);
  if (result?.ok) return result;
  return {
    ok: false,
    error:
      result?.error ||
      bridgeError ||
      'Chrome could not complete the browser action.',
  };
}

function failureResponse(intent, language) {
  const hindi = isHindi(language);
  if (intent === 'open-youtube') {
    return hindi
      ? 'मैं अभी YouTube नहीं खोल पाई। कृपया फिर से कोशिश करें।'
      : "I couldn't open YouTube. Please try again.";
  }
  if (intent === 'new-tab') {
    return hindi
      ? 'मैं नया टैब नहीं खोल पाई। कृपया फिर से कोशिश करें।'
      : "I couldn't open a new tab. Please try again.";
  }
  return hindi
    ? 'मैं Google खोज नहीं खोल पाई। कृपया फिर से कोशिश करें।'
    : "I couldn't open that Google search. Please try again.";
}

async function runBrowserAction(intent, parameters, options = {}) {
  const result = await performBrowserAction(
    browserActionMessage(intent, parameters),
    options,
  );
  const hindi = isHindi(options.language);
  let response;
  if (result.ok) {
    if (intent === 'open-youtube') {
      response = hindi ? 'YouTube खोल रही हूँ।' : 'Opening YouTube.';
    } else if (intent === 'new-tab') {
      response = hindi ? 'नया टैब खोल रही हूँ।' : 'Opening a new tab.';
    } else {
      response = hindi
        ? `Google पर ${parameters.query.trim()} खोज रही हूँ।`
        : `Searching Google for ${parameters.query.trim()}.`;
    }
  } else {
    response = failureResponse(intent, options.language);
  }
  return { ok: result.ok, response, error: result.error };
}

export function createBrowserCommandHandlers() {
  return {
    time: {
      validateParameters: isEmptyParameters,
      async execute(_parameters, { language = 'en-IN', now = new Date() } = {}) {
        return {
          ok: true,
          response: isHindi(language)
            ? `अभी ${now.toLocaleTimeString('hi-IN', {
                hour: 'numeric',
                minute: '2-digit',
              })} बजे हैं।`
            : `It's ${now.toLocaleTimeString('en-IN', {
                hour: 'numeric',
                minute: '2-digit',
              })}.`,
        };
      },
    },
    'open-youtube': {
      validateParameters: isEmptyParameters,
      execute: (_parameters, options) =>
        runBrowserAction('open-youtube', {}, options),
    },
    'new-tab': {
      validateParameters: isEmptyParameters,
      execute: (_parameters, options) => runBrowserAction('new-tab', {}, options),
    },
    'google-search': {
      validateParameters: queryParameterError,
      execute: (parameters, options) =>
        runBrowserAction('google-search', parameters, options),
    },
  };
}
