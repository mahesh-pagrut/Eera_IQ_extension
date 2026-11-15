# Eera

Eera is a personal AI browser assistant being developed as a Chrome extension. The long-term goal is a friendly, conversational assistant that can help with browser tasks using voice and text.

The project has completed **Milestones 1–5**: project foundation, floating assistant UI, orb animations, explicit microphone/speech recognition input, and speech synthesis. The current voice flow also connects final transcripts to a small, deterministic set of local responses and browser actions. Eera displays the same floating assistant widget on its custom new-tab page and on normal HTTP/HTTPS webpages.

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

Run the speech, recognition lifecycle, and local command tests with:

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
6. Open a new tab to see the floating Eera orb. Click it to open or close the assistant panel.

After rebuilding, use **Reload** on the extension card in `chrome://extensions` to load updated output.

## Floating assistant

The widget contains Eera's gradient orb, a greeting and readiness status, recognition-language selection, explicit Listen/Stop controls, and a transcript. The new-tab page and website content script reuse the same React components.

The orb has five visual states: **idle** (gentle breathing and aura), **listening** (expanding sound-wave rings), **processing** (rotating rainbow aura), **speaking** (stronger layered pulsing glow), and **error** (subtle warm warning pulse). These states reflect recognition, command processing, and speech output events. The animations respect the operating system's reduced-motion preference.

On normal webpages, the content script creates a small extension-owned mount point and renders the widget inside an open Shadow DOM. Component styles are embedded into the content-script bundle, which keeps the page's styles from changing Eera and Eera's styles from leaking into the page. The script does not read page content, collect browsing information, or automate the page.

The manifest declares `http://*/*` and `https://*/*` host access and matching content-script patterns so Chrome can inject Eera on normal websites. These broad host patterns are required for an everywhere-on-the-web floating UI; they grant the ability to inject the extension UI, not a feature that reads website contents. Chrome may display a site-access prompt, and users can restrict the extension's site access in Chrome.

## Voice input

1. Load or reload the unpacked extension, then open a new tab or a normal HTTP/HTTPS page.
2. Click the orb to open Eera's panel.
3. Choose **English (India)** (`en-IN`, the default), **English (US)** (`en-US`), or **Hindi / Hinglish (Hindi recognition)** (`hi-IN`).
4. Click **Listen** and respond to Chrome's microphone permission prompt. Speak one utterance; the transcript updates with interim words and the final text.
5. Click **Stop listening** to stop early, or click the orb to close the panel and stop recognition. Click **Listen** again to retry or start another utterance.

Listening never starts automatically. Recognition is one utterance per explicit start, and Eera does not silently restart it. Denying microphone access displays an error; allow microphone access for the current context in Chrome's site settings before retrying. Chrome controls the browser-level microphone indicator and permission.

Eera does not record or save audio and does not upload it to an Eera server. Chrome's [Web Speech implementation](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) may send audio to its online recognition service; network access may be required and service behavior depends on Chrome and its speech provider. Review Chrome's speech and privacy settings before use. Hinglish results are not guaranteed: mixed-language recognition depends on Chrome's service and the selected language.

## Voice responses and supported commands

After a final transcript, Eera stops the recognition session, parses the utterance into a supported local intent, shows the response, and speaks it. There is no AI service, backend, or arbitrary page-script execution. Current commands are intentionally limited:

- Greetings (for example, “hello” or “namaste”).
- Ask for the current time; it uses the device's local clock.
- Open YouTube in a new tab.
- Search Google (for example, “search Google for cats”).
- Open a new tab.
- Unsupported requests receive a clear response describing the available commands.

The parser recognizes a small English/Hindi/Hinglish phrase set. It is not a general language understanding system; speech recognition accuracy still depends on Chrome. Browser actions use fixed HTTPS destinations and a validated extension message; the new-tab extension page has a direct tab-API fallback if the worker has no receiver. Content scripts still require the worker for browser actions and use a speech fallback if the worker bridge disconnects. The command response is informational; no YouTube playback or arbitrary website interaction is implemented.

In the production extension, `src/services/speechSynthesis.js` uses `chrome.tts` (the manifest's `tts` permission) directly on Eera's new-tab page. On websites, it routes speech requests to the MV3 service worker over a named extension port because content scripts cannot call `chrome.tts` directly. If that bridge disconnects, the service falls back to browser Web Speech synthesis and reports an error if that also fails. Chrome uses platform/installed voices (SAPI 5 on Windows); voice names and language coverage vary, and a female-sounding voice is not guaranteed. Defaults are `en-IN`, rate `1.0`, pitch `1.05`, and volume `1.0`. There is no Eera speech server or paid API. The Vite-only speech preview still uses the browser Web Speech API and does not exercise the production extension bridge.

Speech output stops active recognition before beginning and does not automatically resume listening. Closing the panel stops recognition and speech. Microphone capture begins only after the user presses **Listen**; Chrome may send recognition audio to its own online speech service. Eera does not record or save audio.

For development testing only, run `npm run dev` and use the **Speech test** controls to enter text, select a development-browser voice, adjust language/rate/pitch/volume, speak, or stop. These controls are removed from production builds. To test the actual production path, build and reload `dist/` in Chrome, then use Listen and speak a supported command. Playback must be confirmed by listening on the device; mocked service tests and playback events alone do not prove audible output.

## Supported recognition languages

- English (India): `en-IN` (default)
- English (United States): `en-US`
- Hindi: `hi-IN`
- Hinglish can be tried with `hi-IN` or an English locale, but accuracy depends on Chrome's recognition service.

## Current features and limitations

- Replaces Chrome's new-tab page with the floating Eera assistant.
- Injects the same widget on normal HTTP and HTTPS pages using a Shadow DOM content script.
- Orb interaction opens and closes the assistant panel. State selection is available only in the Vite development page for animation review; it is not included in the production UI.
- Listening, processing, speaking, and error orb states follow the active voice pipeline.
- The production voice response path uses Chrome's `chrome.tts` API; the development-only Speech test interface exercises browser speech synthesis instead.
- Speech output supports `en-IN`, `en-US`, and `hi-IN`; voice availability and voice gender identification are platform-dependent.
- Final recognition results currently support a small allowlisted command set (greeting, local time, YouTube tab, Google search tab, and new tab); general conversation, YouTube playback, and arbitrary navigation are not implemented.
- Recognition depends on Chrome exposing the Web Speech API and its speech service; language quality and availability are not guaranteed. An earlier development-browser attempt returned a network error, but English recognition was subsequently confirmed by the user in installed Chrome.
- After reloading the latest `dist` build, the user confirmed audible replies on both the new-tab page and website widget, and confirmed “open YouTube” works from both surfaces. Hindi/Hinglish recognition, other commands, and audio output on other devices remain unverified. No wake-word detection, AI conversation engine, or general browser automation is implemented.
- Chrome website microphone permission behavior should be manually checked on both HTTP and HTTPS pages. See [DEVELOPMENT.md](./DEVELOPMENT.md) for the test record and remaining checks.
