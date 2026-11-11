# Development Milestones

Status values: **Complete**, **Not started**.

## Milestone 1: Project initialization and architecture

- **Objective:** Establish the React/Vite/Tailwind project, MV3 new-tab extension build, and project documentation.
- **Implementation status:** Complete.
- **Files affected:** `package.json`, `package-lock.json`, `.gitignore`, `index.html`, `vite.config.js`, `public/manifest.json`, `public/icons/`, `src/App.jsx`, `src/main.jsx`, `src/index.css`, `src/background/serviceWorker.js`, `README.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `.github/copilot-instructions.md`.
- **Testing requirements:** Run `npm run build`; verify the output manifest, new-tab page, service worker, and icon references exist. Load `dist/` in Chrome and open a new tab as a manual smoke test.
- **Known issues:** Chrome runtime loading and the new-tab page have not yet been manually tested.

## Milestone 2: Eera floating UI and orb

- **Objective:** Add the first reusable assistant interface and initial orb surface.
- **Implementation status:** Not started.
- **Files affected:** To be determined; expected work in `src/components/`, `src/App.jsx`, and styles.
- **Testing requirements:** Verify rendering, responsive layout, and keyboard/accessibility behavior in the supported extension surface.
- **Known issues:** Visual design and supported host-page integration are not defined yet.

## Milestone 3: Orb animations and interaction states

- **Objective:** Add custom CSS animation and clear idle/active interaction states.
- **Implementation status:** Not started.
- **Files affected:** To be determined; expected work in orb components and CSS.
- **Testing requirements:** Verify each state, reduced-motion behavior, and animation performance.
- **Known issues:** Depends on the Milestone 2 interaction design.

## Milestone 4: Microphone integration and speech recognition

- **Objective:** Capture user speech and expose recognition results independently of command execution.
- **Implementation status:** Not started.
- **Files affected:** To be determined; expected work in speech services, UI state, and any required manifest configuration.
- **Testing requirements:** Test permission denial, supported languages, recognition errors, lifecycle behavior, and Chrome support.
- **Known issues:** Recognition context and long-running feasibility have not been established; do not assume an offscreen document is suitable.

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

