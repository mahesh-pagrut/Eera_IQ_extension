# Eera Architecture

## Current foundation

Eera is a frontend-only Chrome extension. The production output in `dist/` is the loadable extension directory:

- `public/manifest.json` is copied to the output root.
- `index.html` is the React new-tab page and is used by `chrome_url_overrides`.
- `src/background/serviceWorker.js` is bundled to `background/serviceWorker.js`.
- `src/content/contentScript.jsx` is bundled separately as the classic script `content/contentScript.js`.
- `public/icons/` contains the PNG icon sizes referenced by the manifest.

Vite's Rollup inputs and output names are configured explicitly in `vite.config.js` and `vite.content.config.js`. The main build emits the new-tab page and service worker; the second build emits a self-contained IIFE content script. The content build does not split chunks or emit a separate CSS asset, which keeps it compatible with Chrome's classic content-script loading and Shadow DOM styling.

## React application

`src/main.jsx` mounts `src/App.jsx` into `index.html`. `App` renders the shared `EeraWidget` component. `src/components/` contains `EeraOrb` for keyboard-accessible click interaction, `EeraPanel` for the greeting and transcript, and small `AssistantStatus` and `Transcript` components. Panel visibility is local React state in `EeraWidget`; no browser command state is involved.

`src/components/eera-widget.css` defines the orb and panel styles and is included in the new-tab stylesheet. The content script imports the same CSS with Vite's `?inline` query, adds the resulting CSS text to a `<style>` element in its Shadow DOM, and mounts the shared React component tree there. This ensures styles are available in the shadow root rather than relying on Vite's normal page CSS injection.

## Orb state and animation

`assistantStates.js` defines the shared `idle`, `listening`, `processing`, `speaking`, and `error` state identifiers and their display labels. `EeraWidget` owns the current state and passes it to `EeraOrb` and the panel status. `EeraOrb` renders a state class and accessible state label; `orb-animations.css` maps those classes to lightweight CSS keyframes. Its animation behavior is presentation-only and does not start speech or browser operations. Later voice/business logic can drive the widget state through props without moving that logic into the orb.

The animation stylesheet is imported by the shared widget stylesheet, so Vite includes the same keyframes in the new-tab CSS and embeds them in the content-script bundle for Shadow DOM use. The reduced-motion media query disables the keyframes while leaving each state visually distinguishable. `AssistantStatePreview` is rendered only when `import.meta.env.DEV` is true, allowing developers to inspect each state in the Vite page without shipping state-selection controls in production.

## Manifest V3 responsibilities

The manifest declares a background service worker, new-tab override, static extension icons, and an HTTP/HTTPS content script. Its `host_permissions` and content-script `matches` use `http://*/*` and `https://*/*`, which allow Chrome to inject the UI on normal websites. This is intentionally broad site access because the milestone asks the widget to appear across normal webpages. It is used only for injection: Eera does not read page content or collect browsing information. The `tts` permission is used for production speech output; no microphone permission is declared.

### Background service worker

The worker listens for installation, named `eera-tts` ports, and a narrow browser-action message protocol. It does not own microphone capture or recognition. Chrome can suspend an MV3 service worker when idle, so it must not own long-lived assistant state or be assumed to run continuously. TTS requests and tab actions are short, event-driven operations; a disconnected TTS port surfaces an error to the widget. Durable state, if later needed, must use an appropriate storage mechanism introduced with that feature.

### Content scripts and Shadow DOM

The content script in `src/content/contentScript.jsx` creates one extension-owned host element and mounts the shared widget into its open Shadow DOM. It does not inspect the page, install page event listeners, or perform page actions. Shadow DOM isolates component styles from page styles; the entry bundle embeds those styles so runtime CSS file loading is unnecessary. The host is fixed to the viewport's bottom-left with pointer events enabled only for the widget itself. Chrome's match restrictions prevent automatic injection on internal/restricted pages.

### New-tab page

The React application runs as the extension's new-tab page, an extension-controlled surface that works around Chrome's restrictions on injecting into internal pages. It renders the same `EeraWidget` as the website content script. Website host permissions are not needed for this extension-owned page.

## Speech recognition

`src/services/speechRecognition.js` owns the Web Speech API lifecycle; React components subscribe to its transcript, error, and status events and do not create recognition objects themselves. The service feature-detects `SpeechRecognition` and Chrome's `webkitSpeechRecognition`, holds one recognizer per widget instance, configures one utterance with interim results, and never restarts it automatically. Start is called directly from the user's Listen click so the browser can present its microphone permission prompt. Stop/abort is called from Stop, panel deactivation, and component cleanup.

The default language is `en-IN`; `en-US` and `hi-IN` are selectable. Hinglish can be tried using either an English locale or `hi-IN`, but recognition quality is determined by Chrome's service and is not guaranteed. Interim and final text updates the transcript. A final result moves the UI to processing and is passed once to the local command parser; recognition is stopped before response speech begins. Explicit stop returns it to idle, and errors are mapped to user-readable messages. Errors do not trigger retries.

Web Speech recognition is invoked in the visible UI context (the extension new-tab page or the website content script's isolated world). It is not run in the MV3 service worker. An offscreen document was not selected: it adds lifecycle and messaging complexity and its SpeechRecognition behavior has not been validated. Content-script and extension-page speech behavior can vary by Chrome version and permission context, so each needs manual Chrome validation. See [MDN's SpeechRecognition documentation](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) for browser support and Web Speech API limitations.

This implementation does not call `getUserMedia`, retain a `MediaStream`, save audio, or send audio to an Eera backend. Chrome's Web Speech implementation may use an online recognition service, so recognition may require a network connection and follows Chrome's speech-service/privacy behavior. Microphone authorization is requested by the browser API when the user explicitly starts listening; no separate microphone permission is declared in the extension manifest. Chrome may apply origin-specific site permission behavior to website content-script contexts; users can deny, revoke, or stop access through Chrome. Closing the Eera panel aborts recognition.

The current proof of concept found the SpeechRecognition constructor in the development browser, but its recognition attempt returned a network error. Actual microphone permissions and spoken English/Hindi/Hinglish transcripts therefore still require manual testing in the installed Chrome extension.

## Extension communication

Speech recognition remains in the visible UI context; website synthesis and browser actions cross into the MV3 worker through Chrome extension messaging. The browser-action message accepts only `new-tab`, `open-youtube`, and `google-search` with a bounded query. The worker constructs fixed HTTPS URLs and calls `chrome.tabs.create`; if the worker has no receiver, the extension new-tab page may use `chrome.tabs.create` directly. A website content script cannot use that direct fallback and reports the failure. No path evaluates user text as code or accepts arbitrary URLs.

The UI shows the transcript and response separately. Recognition, command parsing/execution, and speech synthesis remain separate modules; the widget coordinates their lifecycle.

## Speech synthesis and voice configuration

`src/services/speechSynthesis.js` is independent of React and DOM elements. In an extension page with `chrome.tts`, it uses that API directly. In a website content script, it connects to the worker using a named `eera-tts` runtime port; the worker uses `chrome.tts` and relays voice lists and start/end/error events. If the worker connection fails, the service falls back to `window.speechSynthesis` and `SpeechSynthesisUtterance`. The Vite-only development page uses the same browser fallback because it has no extension APIs.

`speak(text, overrides)` cancels previous output, validates language/rate/pitch/volume, selects the requested or preferred voice, and emits status/error events. `stopSpeaking()` cancels current output; disposal closes the port and stops output. The `tts` manifest permission enables the production path.

Automatic voice selection first looks for a voice in the requested language/locale family, preferring gender metadata marked female or generic feminine/female descriptors in the voice name. If no such match exists, it uses the browser default among compatible voices, then the first compatible voice; with no compatible language it falls back to the browser default or first available voice. Voice name and gender information are not standardized, so this is a preference heuristic, not a guarantee of a female voice. Available voices can appear asynchronously; the service refreshes them on `voiceschanged`. Defaults are `en-IN`, rate `1`, pitch `1.05`, and volume `1`; the supported language choices are `en-IN`, `en-US`, and `hi-IN`.

The widget owns the service instance and maps speech events to the existing assistant state. While output starts/plays, the orb and panel status use `speaking`; completion returns to idle unless another state remains active; synthesis errors are displayed and use the error state. Final recognition text is parsed into explicit local intents, a response is displayed, and the same response is spoken. If speech is requested during recognition, the widget waits for recognition's stop/end event before invoking synthesis. Starting recognition while output is playing first cancels output. The panel close action stops both services. Listening is never automatically resumed after speech.

The current parser intentionally supports only greetings, local device time, open YouTube, Google search, and new-tab requests (with a limited Hindi/Hinglish phrase set). It has a clear unsupported-command response and is not an AI or general conversation engine. The executor performs only allowlisted actions and no page scripting. These starter behaviors do not complete the later personality, YouTube playback, Google navigation, or general tab-management milestones.

The development-only `SpeechSynthesisPreview` component supplies text, voice, language, rate, pitch, volume, Speak, and Stop controls. It is gated by `import.meta.env.DEV`; it is not included in production UI. Configuration is kept in memory in this milestone so future preference persistence can use Chrome Storage without coupling storage to the service.

Speech synthesis in the production extension is routed through `chrome.tts` in the service worker; the API uses platform/installed voices, and voice availability varies. Speech text is sent only to the extension worker, not to an Eera server. The development fallback uses browser Web Speech synthesis. Actual audible playback still needs testing in the installed Chrome extension with audio output enabled.

## Planned command architecture

Future command input should pass through separate stages: speech/text input, parsing into a typed intent, centralized dispatch, and a modular command implementation. Browser actions must use explicit Chrome APIs or narrowly scoped content-script operations; arbitrary AI-generated JavaScript must never be executed.

Personality responses should remain data-driven and separate from command execution. Any AI integration is outside this milestone and must not introduce a paid service or backend without explicit product approval.

## Chrome extension constraints

- Manifest V3 background workers are event-driven and may be suspended.
- Chrome internal pages restrict script injection; the new-tab override is the chosen Eera surface for those pages.
- Content scripts have isolated execution contexts and only the permissions/host access granted to the extension.
- The HTTP/HTTPS host access in this milestone is required for broad UI injection and should be narrowed if a later product decision limits supported sites.
- Extension permissions and host permissions should be added only when a milestone implements and tests the associated feature.
- Extension APIs are not available in a normal Vite development page; test Chrome-specific behavior using the built extension.
