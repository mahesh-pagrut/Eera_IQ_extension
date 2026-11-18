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

`assistantStates.js` defines the shared `idle`, `listening`, `processing`, `speaking`, and `error` visual state identifiers. `conversationSessionManager.js` owns the separate session state (`inactive`, `wake-word-standby`, `command-listening`, `processing`, `speaking`, `follow-up`, and `error`). `EeraWidget` maps session states to orb states and supplies detailed session text to the panel. `EeraOrb` renders a state class and accessible label; `orb-animations.css` maps visual states to CSS keyframes. Animation does not start speech or browser operations.

The animation stylesheet is imported by the shared widget stylesheet, so Vite includes the same keyframes in the new-tab CSS and embeds them in the content-script bundle for Shadow DOM use. The reduced-motion media query disables the keyframes while leaving each state visually distinguishable. `AssistantStatePreview` is rendered only when `import.meta.env.DEV` is true, allowing developers to inspect each state in the Vite page without shipping state-selection controls in production.

## Manifest V3 responsibilities

The manifest declares an ES-module background service worker, new-tab override, static extension icons, and an HTTP/HTTPS content script. Its `host_permissions` and content-script `matches` use `http://*/*` and `https://*/*`, which allow Chrome to inject the UI on normal websites. This is intentionally broad site access because the milestone asks the widget to appear across normal webpages. It is used only for injection: Eera does not read page content or collect browsing information. The `tts` permission is used for production speech output; no microphone permission is declared.

### Background service worker

The worker listens for installation, named `eera-tts` and microphone-lease ports, and a narrow browser-action message protocol. It does not own microphone capture or recognition. The microphone lease broker grants one connected widget the right to run recognition; a heartbeat keeps the short-lived broker connection active, and disconnect releases the lease. A lease disconnect stops the owning widget's recognition and surfaces an error. Chrome can suspend or restart an MV3 service worker, so the worker is not treated as the owner of assistant state or as continuously available. TTS requests, tab actions, and lease messages are event-driven.

### Content scripts and Shadow DOM

The content script in `src/content/contentScript.jsx` creates one extension-owned host element and mounts the shared widget into its open Shadow DOM. It does not inspect the page, install page event listeners, or perform page actions. Shadow DOM isolates component styles from page styles; the entry bundle embeds those styles so runtime CSS file loading is unnecessary. The host is fixed to the viewport's bottom-left with pointer events enabled only for the widget itself. Chrome's match restrictions prevent automatic injection on internal/restricted pages.

### New-tab page

The React application runs as the extension's new-tab page, an extension-controlled surface that works around Chrome's restrictions on injecting into internal pages. It renders the same `EeraWidget` as the website content script. Website host permissions are not needed for this extension-owned page.

## Speech recognition

`src/services/speechRecognition.js` owns the Web Speech API lifecycle; React components subscribe to its transcript, error, and status events and do not create recognition objects themselves. The service feature-detects `SpeechRecognition` and Chrome's `webkitSpeechRecognition`, and supports both the existing single-utterance mode and the continuous/interim mode used by the session manager. `continuous` requests multiple final results; it does not guarantee that the browser's recognition service stays connected. The service reports unexpected `end` events rather than silently pretending recognition continues. The user's orb click explicitly activates Eera and starts microphone recognition; permission denial is surfaced. Stop/abort is called before speech output, on deactivation, and during cleanup.

The default language is `en-IN`; `en-US` and `hi-IN` are selectable. Hinglish can be tried using either an English locale or `hi-IN`, but recognition quality is determined by Chrome's service and is not guaranteed. Interim and final text update the transcript. A final request moves the UI to processing and is passed once to the existing router; recognition stops before response speech begins. Recognition restarts only under the conversation session manager's explicit lifecycle, not as an unbounded service-level loop.

Web Speech recognition is invoked in the visible UI context (the extension new-tab page or the website content script's isolated world). It is not run in the MV3 service worker. An offscreen document was not selected: it adds lifecycle and messaging complexity and its SpeechRecognition behavior has not been validated. Content-script and extension-page speech behavior can vary by Chrome version and permission context, so each needs manual Chrome validation. MDN documents that [`continuous`](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/continuous) requests multiple results and that [`end`](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/end_event) means the recognition service disconnected; neither guarantees an indefinitely active session.

This implementation does not call `getUserMedia`, retain a `MediaStream`, save audio, or send audio to an Eera backend. Chrome's Web Speech implementation may use an online recognition service, so recognition may require a network connection and follows Chrome's speech-service/privacy behavior. No separate microphone permission is declared in the extension manifest. Chrome may apply different permission behavior to extension pages and website content-script contexts; users can deny or revoke permission through Chrome. Hiding the panel does not deactivate an already active assistant; **Deactivate Eera** stops recognition, and page/component cleanup also stops it.

The available VS Code browser reported a `SpeechRecognition` constructor and microphone permission state, and its constructor defaults were `continuous=false` and `interimResults=false`. This is a VS Code Electron/Chromium context, not proof of recognition behavior in installed Chrome. Starting recognition and capturing user audio were intentionally not performed during development; actual permission, continuous-session, wake phrase, language, and recovery behavior still require manual tests in the installed extension.

## Wake-word and conversation session

`src/services/wakeWord/wakeWordDetector.js` normalizes case, punctuation, and whitespace while preserving Unicode combining marks (needed for Devanagari vowels). It matches `Hey Eera` and common English/Hindi recognition variants such as `Hey Era`, `Hey Erra`, `Here` at the start of a transcript, `हे एरा`, and `हे ईरा`. Accepting `Here` by itself lets the manager enter command-listening if Chrome splits wake and request into separate final results; it is not matched at the end of unrelated sentences. For same-utterance requests, it returns the original normalized words after the wake phrase so Hindi command text remains intact; the wake phrase itself never reaches `messageRouter.js`. Nonmatching final speech in wake-word standby is ignored.

`src/services/conversationSessionManager.js` coordinates the recognition service, the microphone lease, the existing request pipeline, and timers. Activation enters wake-word standby; a wake phrase moves to command listening; accepted text moves to processing; synthesis events drive speaking; after speech the manager starts the 12-second follow-up window. Follow-up speech can omit the wake phrase. When the window expires, Eera returns to standby without another orb click. The default 60-minute inactivity timer deactivates recognition, releases the lease, clears other timers, and returns to inactive. Both durations and recovery limits are in `wakeWordConfig.js`.

The manager retries unexpected recognition/service termination with bounded delays and stops after the configured maximum. Permission-denied, unsupported-language, missing-microphone, and service-not-allowed failures are terminal until the user retries. On a continuous service disconnection, the UI shows an error rather than claiming the microphone is still active. The wake phrase is detected from Chrome's recognized text; it is not an acoustic/local wake-word engine and may be affected by service latency, network availability, language selection, false recognition, and browser throttling.

## Extension communication

Speech recognition remains in the visible UI context; the worker brokers exclusive microphone ownership but never handles audio or transcripts. A short heartbeat lets the broker detect loss of its volatile lease state after worker restart; the UI fails closed and stops recognition rather than assuming it still owns the microphone. Website synthesis and browser actions also cross into the worker through Chrome extension messaging. The browser-action message accepts only `new-tab`, `open-youtube`, and `google-search` with a bounded query. The worker constructs fixed HTTPS URLs and calls `chrome.tabs.create`; if the worker has no receiver, the extension new-tab page may use `chrome.tabs.create` directly. A website content script cannot use that direct fallback and reports the failure. No path evaluates user text as code or accepts arbitrary URLs.

The UI shows the transcript and response separately. Recognition, command parsing/execution, conversation handling, and speech synthesis remain separate modules; the widget coordinates their lifecycle. A **Clear conversation** action clears in-memory context and the displayed turn without writing anything to storage.

## Personality and conversation

`src/data/personality/eeraIdentity.js` is the central identity configuration: assistant name/description, optional creator name, default language, capabilities, personality traits, greeting styles, and response tone. Creator attribution is deliberately blank by default; Eera never invents a creator. `src/data/personality/personalityResponses.js` contains short varied responses per intent and language.

`src/services/conversation/conversationEngine.js` recognizes conversational intent and selects a localized response. It handles greetings, introductions, questions about the assistant, creator/capabilities questions, thanks, farewells, apologies, mood questions, simple follow-ups, and a friendly unknown-intent clarification. Its response selector avoids consecutive duplicate variants for the same intent/language.

`conversationContext.js` holds a bounded list of recent user/assistant turns in memory for the widget lifetime. Browser commands are recorded there too, so simple follow-ups can refer to the latest turn. Context can be cleared and is not persisted to Chrome Storage, a database, or a backend.

`languageDetector.js` chooses English, Hindi, or Hinglish using Devanagari script, phrase-level Hinglish matches, and multiple Romanized Hindi markers. A single shared/borrowed Hindi word alone is not enough to classify a Roman-script message as Hindi. The selected recognition locale is only a fallback where text is ambiguous. Hindi and Hinglish responses use `hi-IN` for speech; English retains the selected English locale.

`messageRouter.js` gives the existing command parser first opportunity to identify a recognized browser action or local time request. Those intents alone reach `commandExecutor.js`; greetings and all other conversation go to the personality engine. The personality engine cannot execute browser actions. The voice-response handler passes the response text and selected speech language to the existing widget-owned speech service.

## Speech synthesis and voice configuration

`src/services/speechSynthesis.js` is independent of React and DOM elements. In an extension page with `chrome.tts`, it uses that API directly. In a website content script, it connects to the worker using a named `eera-tts` runtime port; the worker uses `chrome.tts` and relays voice lists and start/end/error events. If the worker connection fails, the service falls back to `window.speechSynthesis` and `SpeechSynthesisUtterance`. The Vite-only development page uses the same browser fallback because it has no extension APIs.

`speak(text, overrides)` cancels previous output, validates language/rate/pitch/volume, selects the requested or preferred voice, and emits status/error events. `stopSpeaking()` cancels current output; disposal closes the port and stops output. The `tts` manifest permission enables the production path.

Automatic voice selection first looks for a voice in the requested language/locale family, preferring gender metadata marked female or generic feminine/female descriptors in the voice name. If no such match exists, it uses the browser default among compatible voices, then the first compatible voice; with no compatible language it falls back to the browser default or first available voice. Voice name and gender information are not standardized, so this is a preference heuristic, not a guarantee of a female voice. Available voices can appear asynchronously; the service refreshes them on `voiceschanged`. Defaults are `en-IN`, rate `1`, pitch `1.05`, and volume `1`; the supported language choices are `en-IN`, `en-US`, and `hi-IN`.

The widget owns the service instance and maps speech events to the existing assistant state. While output starts/plays, the orb and panel status use `speaking`; completion returns to idle unless another state remains active; synthesis errors are displayed and use the error state. Final recognition text is parsed into explicit local intents, a response is displayed, and the same response is spoken. If speech is requested during recognition, the widget waits for recognition's stop/end event before invoking synthesis. Starting recognition while output is playing first cancels output. The panel close action stops both services. Listening is never automatically resumed after speech.

The current parser intentionally supports local device time, open YouTube, Google search, and new-tab requests (with a limited Hindi/Hinglish phrase set). Unknown/non-command input is routed to the personality engine rather than executing any browser action. The executor performs only allowlisted actions and no page scripting. These starter behaviors do not complete the later YouTube playback or general tab-management milestones.

The development-only `SpeechSynthesisPreview` component supplies text, voice, language, rate, pitch, volume, Speak, and Stop controls. It is gated by `import.meta.env.DEV`; it is not included in production UI. Speech configuration remains in memory so future preference persistence can use Chrome Storage without coupling storage to the service.

Speech synthesis in the production extension uses `chrome.tts` on extension pages and the service worker bridge for website content scripts; the API uses platform/installed voices, and voice availability varies. Speech text is not sent to an Eera server. The development fallback uses browser Web Speech synthesis. The user confirmed audible English replies from both extension surfaces on the previous build; Milestone 6 Hindi/Hinglish speech still needs manual testing.

## Planned command architecture

Future command input should pass through separate stages: speech/text input, parsing into a typed intent, centralized dispatch, and a modular command implementation. Browser actions must use explicit Chrome APIs or narrowly scoped content-script operations; arbitrary AI-generated JavaScript must never be executed.

Personality responses are data-driven and separate from command execution. This local milestone does not add AI integration, a paid service, or a backend.

## Chrome extension constraints

- Manifest V3 background workers are event-driven and may be suspended.
- Chrome internal pages restrict script injection; the new-tab override is the chosen Eera surface for those pages.
- Content scripts have isolated execution contexts and only the permissions/host access granted to the extension.
- The HTTP/HTTPS host access in this milestone is required for broad UI injection and should be narrowed if a later product decision limits supported sites.
- Extension permissions and host permissions should be added only when a milestone implements and tests the associated feature.
- Extension APIs are not available in a normal Vite development page; test Chrome-specific behavior using the built extension.
