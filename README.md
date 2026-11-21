# Eera

Eera is a personal AI browser assistant being developed as a Chrome extension. The long-term goal is a friendly, conversational assistant that can help with browser tasks using voice and text.

The project has implemented **Milestones 1–8**: project foundation, floating assistant UI, orb animations, speech recognition/synthesis, a local voice-response pipeline, a modular personality/conversation engine, a controlled wake-word/follow-up session, and a validated command parser/dispatcher. Eera displays the same floating assistant widget on its custom new-tab page and on normal HTTP/HTTPS webpages.

## Technology

- React and JavaScript (ES modules)
- Vite
- Tailwind CSS 4
- Chrome Extension Manifest V3
- Web Speech API (`SpeechRecognition`, with Chrome's `webkitSpeechRecognition` fallback)
- Chrome TTS API (`chrome.tts`) for production extension speech output
- Web Speech API synthesis for the Vite development preview

The project is frontend-only. It does not use a custom backend, database, or paid API.

## Prerequisites

- Node.js 20.19+ or 22.12+
- npm 10+
- Google Chrome for loading and manually testing the unpacked extension

## Install

From the project directory:

```sh
npm install
```

## Development

Run the Vite development server:

```sh
npm run dev
```

This serves the React page for browser-based UI development. It does not load the extension manifest or emulate Chrome extension APIs.

Run the speech, recognition lifecycle, conversation, parser, dispatcher, and local command tests with:

```sh
npm test
```

## Production build

Create the unpacked extension files in `dist/`:

```sh
npm run build
```

Vite explicitly bundles the new-tab page and the MV3 background service worker. It also copies `public/manifest.json` and the referenced icon images to the output directory.

The build then runs a second Vite configuration to produce `dist/content/contentScript.js` as a self-contained classic script. The widget stylesheet is embedded in that bundle and applied inside its Shadow DOM.

## Load in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Choose **Load unpacked**.
5. Select this project's `dist` directory.
6. Open a new tab to see the floating Eera orb. Click it to activate Eera and open or close the assistant panel.

After rebuilding, use **Reload** on the extension card in `chrome://extensions` to load updated output.

## Floating assistant

The widget contains Eera's gradient orb, a greeting and readiness status, recognition-language selection, an activation/deactivation control, and a transcript. The new-tab page and website content script reuse the same React components.

The orb has five visual states: **idle** (gentle breathing and aura), **listening** (expanding sound-wave rings), **processing** (rotating rainbow aura), **speaking** (stronger layered pulsing glow), and **error** (subtle warm warning pulse). These states reflect recognition, command processing, and speech output events. The animations respect the operating system's reduced-motion preference.

On normal webpages, the content script creates a small extension-owned mount point and renders the widget inside an open Shadow DOM. Component styles are embedded into the content-script bundle, which keeps the page's styles from changing Eera and Eera's styles from leaking into the page. The script does not read page content, collect browsing information, or automate the page.

The manifest declares `http://*/*` and `https://*/*` host access and matching content-script patterns so Chrome can inject Eera on normal websites. These broad host patterns are required for an everywhere-on-the-web floating UI; they grant the ability to inject the extension UI, not a feature that reads website contents. Chrome may display a site-access prompt, and users can restrict the extension's site access in Chrome.

## Voice input

1. Load or reload the unpacked extension, then open a new tab or a normal HTTP/HTTPS page.
2. Click the orb to activate Eera. This explicitly starts microphone recognition; allow the browser permission prompt if asked.
3. Choose **English (India)** (`en-IN`, the default), **English (US)** (`en-US`), or **Hindi / Hinglish (Hindi recognition)** (`hi-IN`). Eera restarts recognition with the selected language.
4. Say **“Hey Eera”**, then speak a request. Saying the wake phrase and request in one utterance is also supported. Chrome may transcribe it as “Hey Era,” “Hey Erra,” or collapse it to “Here”; Hindi recognition spellings such as “हे एरा” and “हे ईरा” are also accepted. The one-word “Here” variant activates only when followed by a request. Other speech without a matching wake phrase is ignored while in standby.
5. After Eera replies, speak another request within the 12-second follow-up window without repeating the wake phrase. After the window, Eera returns to wake-word standby. It deactivates after 60 minutes without meaningful interaction.
6. Click **Deactivate Eera** in the panel to stop the microphone. The orb can hide/show the panel without deactivating an active session. When inactive, click the orb to activate again.

Wake detection is phrase matching over recognized speech, not native or on-device wake-word detection. Matching preserves Hindi Unicode marks and allows a small set of common speech-recognition spellings for “Eera.” The collapsed “Here” variant is accepted only at the start of a transcript; when it arrives as its own recognition result, Eera waits for the following command. Continuous recognition may disconnect or be unsupported in some contexts; Eera attempts at most three delayed recoveries before surfacing an error. Permission denial, missing microphone, unsupported recognition, and speech-service errors are surfaced and do not cause infinite retries. If another Eera tab already owns microphone recognition, activation is declined until it is deactivated.

Eera does not record or save audio and does not upload it to an Eera server. Chrome's [Web Speech implementation](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) may send audio to its online recognition service; network access may be required and service behavior depends on Chrome and its speech provider. Review Chrome's speech and privacy settings before use. Hinglish results are not guaranteed: mixed-language recognition depends on Chrome's service and the selected language.

## Voice responses and supported commands

After a final transcript, Eera stops recognition and routes the message through the command pipeline. `commandParser.js` normalizes input and emits a structured result (`type`, `intent`, `parameters`, `confidence`, and `normalizedText`); it never executes an action. `commandValidator.js` checks the result shape, registered intent, and handler-specific parameters before `commandDispatcher.js` invokes a handler. Explicit browser commands use the registered handlers in `commands/browserCommandHandlers.js`. Website handlers use `chrome.runtime.sendMessage` by default to ask the extension worker to create tabs; the extension new-tab page has a direct Chrome tabs API fallback. Unsupported command text is sent to the local personality engine; greetings and other conversational messages never execute browser actions. Responses return through the existing voice handler to speech synthesis. No AI service, backend, or arbitrary page-script execution is used. Current browser commands are intentionally limited:

- Ask for the current time; it uses the device's local clock.
- Open YouTube in a new tab.
- Search Google (for example, “search Google for cats”).
- Open a new tab.

You can combine **open a new tab and search** in one phrase (for example, “open new tab and search cat”); Eera opens one Google results tab rather than a blank tab followed by another tab. The parser recognizes a limited English/Hindi/Hinglish phrase set and returns an explicit unsupported result when there is no command match. Handler validation rejects unexpected parameters, missing/empty search terms, and queries over 500 characters. The dispatcher reports execution failures without claiming success. Browser handlers use fixed HTTPS destinations and validated extension messages; search text is encoded as a query value, never treated as a URL. To add a future command, create a dispatcher with `createCommandDispatcher({ conversationEngine })`, register an intent with `dispatcher.registerHandler(intent, { validateParameters, execute })`, and add a corresponding parser rule when it should be recognized from user text. The conversation engine also handles greetings, introductions, questions about Eera and her capabilities, thanks, farewells, apologies, mood questions, and simple follow-ups. Unknown questions receive a friendly clarification rather than triggering a browser action. This remains a rule-based local assistant, not a general language model; speech recognition accuracy still depends on Chrome. The command response is informational; no YouTube playback or arbitrary website interaction is implemented.

## Personality and conversation

The identity, configurable creator name, default language, capabilities, personality traits, greeting styles, and tone live in `src/data/personality/eeraIdentity.js`. Update the `creator.name` value there when the project's creator should be named; when it is blank, Eera says that creator information has not been configured rather than guessing.

Responses and their English, Hindi, and Hinglish variations are kept in `personalityResponses.js`. The local language detector uses Devanagari script, several Romanized Hindi markers, recognized Hinglish phrases, and the selected recognition language as a fallback; a single borrowed Hindi word does not automatically make a message Hindi. Hindi and Hinglish replies are sent to speech synthesis with `hi-IN`; English uses the selected English locale.

Conversation context is held in memory only for the lifetime of the widget. It keeps a bounded set of recent user/assistant turns to support brief follow-ups, including “tell me more” and “what did I ask?”. Use **Clear conversation** in the panel to discard that context and clear the visible turn. No personal memory is written to storage or a database.

In the production extension, `src/services/speechSynthesis.js` uses `chrome.tts` (the manifest's `tts` permission) directly on Eera's new-tab page. On websites, it routes speech requests to the MV3 service worker over a named extension port because content scripts cannot call `chrome.tts` directly. If that bridge disconnects during a reply, the service reconnects and retries once, then falls back to browser Web Speech synthesis. A disconnect while only loading the voice list does not show a speech error; errors are surfaced if an active reply cannot be recovered. Chrome uses platform/installed voices (SAPI 5 on Windows); voice names and language coverage vary, and a female-sounding voice is not guaranteed. Defaults are `en-IN`, rate `1.0`, pitch `1.05`, and volume `1.0`. There is no Eera speech server or paid API. The Vite-only speech preview still uses the browser Web Speech API and does not exercise the production extension bridge.

Speech output pauses recognition so Eera does not intentionally process its own reply; recognition resumes in the follow-up state after speech ends. Deactivating Eera or the 60-minute inactivity timeout stops recognition and clears timers. Closing the panel alone does not deactivate an active session. Chrome may send recognition audio to its own online speech service; Eera does not record or save audio.

For development testing only, run `npm run dev` and use the **Speech test** controls to enter text, select a development-browser voice, adjust language/rate/pitch/volume, speak, or stop. These controls are removed from production builds. To test command behavior, build and reload `dist/` in Chrome, activate Eera on a normal website, say “Hey Eera, open a new tab”, and confirm one new tab appears. Also try “Hey Eera, open new tab and search cat”; this should open one Google results tab for “cat”. Actual microphone, recognition, and browser behavior must be tested in the installed Chrome extension; mocked tests do not establish that the speech service works in a particular browser context.

For Milestone 6 testing, try “Hello”, “Who are you?”, “Who created you?”, “What can you do?”, “Thanks”, “How are you?”, “Tell me more”, and “What did I ask?” in English, Hindi, and Hinglish. Verify the transcript, displayed answer, spoken language, and the **Clear conversation** action. Existing browser commands such as “Open YouTube” and “Search Google for cats” should still execute through the command pipeline.

## Supported recognition languages

- English (India): `en-IN` (default)
- English (United States): `en-US`
- Hindi: `hi-IN`
- Hinglish can be tried with `hi-IN` or an English locale, but accuracy depends on Chrome's recognition service.

## Current features and limitations

- Replaces Chrome's new-tab page with the floating Eera assistant.
- Injects the same widget on normal HTTP and HTTPS pages using a Shadow DOM content script.
- Clicking the orb activates Eera while inactive and toggles the panel while active. **Deactivate Eera** explicitly stops listening.
- Standby, command listening, processing, speaking, follow-up, and error are reflected in the panel status and mapped to the existing orb animation states.
- The default wake phrase is `Hey Eera`. Common recognized variants (`Hey Era`, `Hey Erra`, `Here` followed by a request, `हे एरा`, and `हे ईरा`) are accepted; standby ignores speech that does not contain a matching wake phrase.
- A 12-second follow-up window and 60-minute inactivity timeout are configurable in `src/services/wakeWord/wakeWordConfig.js`.
- The MV3 worker brokers a single microphone lease so the new-tab page and website widget do not intentionally run separate recognition sessions simultaneously.
- The production voice response path uses Chrome's `chrome.tts` API; the development-only Speech test interface exercises browser speech synthesis instead.
- Speech output supports `en-IN`, `en-US`, and `hi-IN`; voice availability and voice gender identification are platform-dependent.
- Final recognition results use the validated command parser/dispatcher and small registered browser-handler set; unsupported text goes to local personality responses. This is not a general AI system; YouTube playback and arbitrary navigation are not implemented.
- Recognition depends on Chrome exposing the Web Speech API and its speech service; language quality and availability are not guaranteed. Continuous recognition is not guaranteed to stay connected. Recovery is bounded to three attempts with increasing delays.
- The user confirmed that the wake phrase successfully triggers “open YouTube” on a YouTube tab. The follow-up/timer/recovery states are covered by automated tests; other Chrome scenarios (including the custom new-tab page, permission denial, and inactivity timeout) still need manual verification. No local wake-word model, external AI, or general browser automation is implemented.
- Chrome website microphone permission behavior should be manually checked on both HTTP and HTTPS pages. See [DEVELOPMENT.md](./DEVELOPMENT.md) for the test record and remaining checks.
