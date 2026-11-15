# Development Milestones

Status values: **Complete**, **Partial**, **Not started**.

## Milestone 1: Project initialization and architecture

- **Objective:** Establish the React/Vite/Tailwind project, MV3 new-tab extension build, and project documentation.
- **Implementation status:** Complete.
- **Files affected:** `package.json`, `package-lock.json`, `.gitignore`, `index.html`, `vite.config.js`, `public/manifest.json`, `public/icons/`, `src/App.jsx`, `src/main.jsx`, `src/index.css`, `src/background/serviceWorker.js`, `README.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `.github/copilot-instructions.md`.
- **Testing requirements:** Run `npm run build`; verify the output manifest, new-tab page, service worker, and icon references exist. Load `dist/` in Chrome and open a new tab as a manual smoke test.
- **Known issues:** None recorded for the project foundation.

## Milestone 2: Eera floating UI and orb

- **Objective:** Add the reusable floating assistant interface to normal webpages and the custom new-tab page.
- **Implementation status:** Complete.
- **Files affected:** `package.json`, `public/manifest.json`, `vite.content.config.js`, `src/App.jsx`, `src/index.css`, `src/components/EeraOrb.jsx`, `src/components/EeraWidget.jsx`, `src/components/EeraPanel.jsx`, `src/components/AssistantStatus.jsx`, `src/components/Transcript.jsx`, `src/components/eera-widget.css`, `src/content/contentScript.jsx`, `README.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`.
- **Features implemented:** Static iridescent orb with hover/focus feedback; click and keyboard toggle for the assistant panel; greeting, ready status, voice placeholder, and waiting transcript; shared React widget on the new-tab page and in an isolated Shadow DOM on HTTP/HTTPS pages.
- **Testing requirements:** `npm run build`; verify manifest-referenced files and the self-contained content script; render and interact with the new-tab app; manually reload the unpacked extension and test an HTTP page and an HTTPS page in Chrome.
- **Build verification:** Production build succeeded for the new-tab page, service worker, and single-file content script. Manifest references and embedded content-script UI/style markers were verified.
- **Known issues:** Website injection has not been manually tested in Chrome in this implementation. The widget is static; voice and page interaction are not implemented.

## Milestone 3: Orb animations and interaction states

- **Objective:** Add custom CSS animation and clear idle/active interaction states.
- **Implementation status:** Complete.
- **Files affected:** `src/components/assistantStates.js`, `src/components/AssistantStatePreview.jsx`, `src/components/AssistantStatus.jsx`, `src/components/EeraOrb.jsx`, `src/components/EeraPanel.jsx`, `src/components/EeraWidget.jsx`, `src/components/orb-animations.css`, `src/components/eera-widget.css`, `README.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`.
- **Features implemented:** Five state-driven CSS animation variants; state-aware accessible orb labels and panel status; reduced-motion alternatives; a dev-only state selector in the Vite development page.
- **Testing requirements:** Run `npm run build`; check both generated styles contain all state selectors/keyframes and reduced-motion rules; confirm the production bundle omits preview controls; use the development selector to check all states and reduced-motion behavior; reload the unpacked extension and inspect new-tab/website surfaces in Chrome.
- **Build verification:** Production builds succeeded for the new-tab page and standalone content script. Verified state styles and reduced-motion rules in both output bundles and confirmed preview-control text is absent from production JavaScript. Exercised all five states using the development selector and verified computed animation names; with reduced motion emulated, each animated element reported `animation: none`.
- **Known issues:** Speaking is a simulated visual state; no audio activity drives it. Website rendering is shared through the verified content-script build, but extension-site animation appearance has not been manually re-verified in Chrome for this milestone.

## Milestone 4: Microphone integration and speech recognition

- **Objective:** Capture user speech and expose recognition results independently of command execution.
- **Implementation status:** Complete (build and simulated lifecycle verified; actual speech tests remain environment-limited).
- **Architecture decision:** Use feature-detected Web Speech API recognition in the visible UI context, started directly by the Listen click. Do not use the MV3 worker or an offscreen document. Use one utterance per explicit start and no automatic restart. The browser requests microphone access at runtime; no manifest microphone permission is declared.
- **Files affected:** `src/services/speechRecognition.js`, `src/components/EeraWidget.jsx`, `src/components/EeraPanel.jsx`, `src/components/Transcript.jsx`, `src/components/AssistantStatus.jsx`, `src/components/eera-widget.css`, `README.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`.
- **Features implemented:** Listen/Stop control; default `en-IN` and selectable `en-US`/`hi-IN`; interim/final transcript updates; actual recognition status drives idle/listening/processing/error orb states; close-panel stop/abort; readable handling for permission denial, unavailable API, missing microphone, no speech, network/service errors, and unexpected termination; retry after errors.
- **Testing completed:** `npm run build` passed for new-tab and content-script bundles. A fake SpeechRecognition browser harness exercised interim/final text, language configuration, stop, retry after permission error, processing/listening/idle/error states, and stop-on-panel-close. Service-level tests verified duplicate-start prevention, single recognizer creation, teardown, unavailable API handling, and permission-denied messaging. An earlier development-browser attempt returned `network`; after reloading the current extension build, the user confirmed English voice recognition and command flow on both extension surfaces.
- **Testing still required in installed Chrome:** Allow/deny microphone permission, Hindi and mixed Hindi-English recognition, unavailable microphone/API, and stop behavior across panel close/navigation/reload.
- **Known issues:** Chrome may use an online speech-recognition service; internet access and service availability are outside Eera's control. SpeechRecognition availability and microphone permission behavior vary by browser/context. Hinglish accuracy is not guaranteed. There is no speech synthesis, wake word, or command processing.

## Milestone 5: Speech synthesis and voice configuration

- **Objective:** Add spoken responses and configurable voice behavior.
- **Implementation status:** Complete (mocked service tests, simulated UI integration, production build, and unmocked browser synthesis events verified).
- **Architecture decision:** Keep synthesis in a UI-independent service. Extension pages call `chrome.tts` directly; website content scripts route through the MV3 worker because they cannot call that API directly. The browser Web Speech service is a fallback if the worker bridge disconnects, and remains the Vite-only preview implementation. The worker handles short requests/events only and does not run microphone work.
- **Files affected:** `package.json`, `public/manifest.json`, `src/services/speechSynthesis.js`, `src/services/speechSynthesis.test.js`, `src/services/speechRecognition.js`, `src/background/serviceWorker.js`, `src/components/EeraWidget.jsx`, `src/components/EeraPanel.jsx`, `src/components/Transcript.jsx`, `src/components/SpeechSynthesisPreview.jsx`, `src/components/eera-widget.css`, `README.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`.
- **Features implemented:** Reusable speak/stop service with support detection, asynchronous voice loading, automatic or explicit voice choice, configurable `en-IN`/`en-US`/`hi-IN`, rate/pitch/volume validation, status/error events, cancellation of prior output, and disposal. Dev-only controls test text, voice, language, rate, pitch, and volume. Widget stops and awaits recognition shutdown before output and does not resume listening afterward.
- **Testing completed:** Existing service unit tests cover voice retrieval, language/female/default fallback, configuration, cancellation, status/error events, and cleanup. The Vite browser test confirmed unmocked Web Speech synthesis lifecycle events, but it did not confirm audible output in the installed extension.
- **Testing completed:** After reloading the latest unpacked build, the user confirmed audible English replies from both the new-tab and website contexts.
- **Testing still required:** Stop/cancel during active speech and other language voices. Browser/OS voice lists may differ between contexts.
- **Known issues:** Female-sounding selection is heuristic because voice names/gender metadata are not standardized; a female voice is not guaranteed. Installed-Chrome extension-context audio output is not yet verified.

## Voice response pipeline repair (between Milestones 5 and 6)

- **Objective:** Fix the gap where final recognition transcripts were displayed but never handled, and route production speech through Chrome's extension TTS API.
- **Implementation status:** Implemented; automated checks pass. User-confirmed audible replies and “open YouTube” commands work on both extension surfaces after reloading the latest `dist` build.
- **Architecture decision:** The widget forwards each distinct final transcript through a small parser and executor. The worker accepts only fixed actions (`new-tab`, `open-youtube`, `google-search`) and creates fixed HTTPS destinations. Local greeting/time/unsupported replies do not require browser APIs. Extension pages call `chrome.tts` directly; website content scripts use a named runtime port to the worker and fall back to browser synthesis if the worker disconnects. The worker does not perform microphone capture. No arbitrary JavaScript or URL execution is permitted.
- **Files affected:** `public/manifest.json`, `package.json`, `src/background/serviceWorker.js`, `src/components/EeraWidget.jsx`, `src/components/EeraPanel.jsx`, `src/components/Transcript.jsx`, `src/components/eera-widget.css`, `src/services/speechRecognition.js`, `src/services/speechSynthesis.js`, `src/services/commandParser.js`, `src/services/commandExecutor.js`, `src/services/commandPipeline.test.js`, `src/services/speechRecognition.test.js`, `src/services/speechSynthesis.test.js`, `README.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`.
- **Automated testing:** Added command parsing/execution tests, recognition final-result/stop lifecycle tests, Chrome TTS direct/bridge/fallback tests, and an extension-page tab-action fallback test. `npm test` passes 21 tests.
- **Manual testing completed:** User tested the latest unpacked build on the new-tab page and a website: spoken replies were audible on both; “open YouTube” opened a tab from both.
- **Manual testing still needed:** Verify local time, Google search, new-tab, unsupported requests, Hindi/Hinglish, recognition denial, and speech stop/cancel behavior.
- **Known limitations:** This is a deliberately small deterministic command set, not Milestone 6's personality/conversation engine. Hinglish parsing and recognition are limited. Manual Chrome validation is user-reported rather than independently observed in this session.

## Milestone 6: Personality and conversational response engine

- **Objective:** Add extensible personality data and basic conversational response selection.
- **Implementation status:** Not started.
- **Files affected:** To be determined; expected work in `src/data/personality/` and response services.
- **Testing requirements:** Verify response selection, fallback behavior, and separation from browser commands.
- **Known issues:** No AI service or backend is included in the current foundation.

## Milestone 7: Wake-word detection and conversation window

- **Objective:** Add an explicit wake-word/conversation interaction flow.
- **Implementation status:** Not started.
- **Files affected:** To be determined; expected work in UI, speech services, and lifecycle handling.
- **Testing requirements:** Test start/stop behavior, false activations, privacy indicators, and resource cleanup.
- **Known issues:** Wake-word support and its runtime cost require feasibility testing.

## Milestone 8: Command parser and command dispatcher

- **Objective:** Parse user input into explicit intents and route intents through a centralized dispatcher.
- **Implementation status:** Partial foundation exists in `commandParser.js` and `commandExecutor.js`; the full milestone remains pending.
- **Files affected:** To be determined; expected work in parser, dispatcher, command contracts, and tests.
- **Testing requirements:** Test supported utterances, ambiguous input, unknown commands, and error propagation.
- **Known issues:** Only a small fixed command set is implemented; modular command modules and broader validation/testing remain future work.

## Milestone 9: YouTube search and playback

- **Objective:** Implement scoped YouTube search and playback commands.
- **Implementation status:** Not started.
- **Files affected:** To be determined; expected work in command modules and browser messaging.
- **Testing requirements:** Verify search URL/input handling, playback behavior, permissions, and failure cases.
- **Known issues:** YouTube UI changes may affect supported interactions.

## Milestone 10: Google search and website navigation

- **Objective:** Implement Google search and safe website navigation commands.
- **Implementation status:** Not started.
- **Files affected:** To be determined; expected work in command modules and URL validation.
- **Testing requirements:** Verify query encoding, URL handling, navigation, and rejected unsafe inputs.
- **Known issues:** Host access should remain minimal and explicit.

## Milestone 11: Instagram profile search

- **Objective:** Add an Instagram profile search command.
- **Implementation status:** Not started.
- **Files affected:** To be determined; expected work in the Instagram command module.
- **Testing requirements:** Verify query handling, navigation, login/availability cases, and host permission scope.
- **Known issues:** Instagram behavior may depend on login state and site changes.

## Milestone 12: Browser tab management and supported webpage interactions

- **Objective:** Add explicit tab operations and limited supported-page interactions.
- **Implementation status:** Not started.
- **Files affected:** To be determined; expected work in browser commands, content scripts, and message handlers.
- **Testing requirements:** Verify tab targeting, permission scope, message validation, and unsupported-page behavior.
- **Known issues:** Chrome internal pages and arbitrary page execution remain restricted.

## Milestone 13: Testing, optimization, and packaging

- **Objective:** Validate supported features, optimize the extension, and prepare a release package.
- **Implementation status:** Not started.
- **Files affected:** To be determined; likely tests, build configuration, documentation, and release assets.
- **Testing requirements:** Run automated suites and production build; manually verify supported Chrome flows and package contents.
- **Known issues:** The complete feature and browser compatibility matrix is not yet known.
