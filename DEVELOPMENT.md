# Development Milestones

Status values: **Complete**, **Not started**.

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
- **Testing completed:** `npm run build` passed for new-tab and content-script bundles. A fake SpeechRecognition browser harness exercised interim/final text, language configuration, stop, retry after permission error, processing/listening/idle/error states, and stop-on-panel-close. Service-level tests verified duplicate-start prevention, single recognizer creation, teardown, unavailable API handling, and permission-denied messaging. A real Web Speech start was attempted in the available Chrome-based development browser; the API was present but returned `network`, so no real spoken transcript or language accuracy was verified.
- **Testing still required in installed Chrome:** Allow and deny microphone permission on the new-tab and website contexts; speak English, Hindi, and mixed Hindi-English; test an unavailable microphone/API; verify recognition stops via Stop, panel close, navigation, and extension reload.
- **Known issues:** Chrome may use an online speech-recognition service; internet access and service availability are outside Eera's control. SpeechRecognition availability and microphone permission behavior vary by browser/context. Hinglish accuracy is not guaranteed. There is no speech synthesis, wake word, or command processing.

## Milestone 5: Speech synthesis and voice configuration

- **Objective:** Add spoken responses and configurable voice behavior.
- **Implementation status:** Not started.
- **Files affected:** To be determined; expected work in speech synthesis service, UI, and configuration data.
- **Testing requirements:** Test available voices, interruption/cancellation, language selection, and unsupported environments.
- **Known issues:** Available voices vary by operating system and browser.

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
- **Implementation status:** Not started.
- **Files affected:** To be determined; expected work in parser, dispatcher, command contracts, and tests.
- **Testing requirements:** Test supported utterances, ambiguous input, unknown commands, and error propagation.
- **Known issues:** No command execution is part of earlier milestones.

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
