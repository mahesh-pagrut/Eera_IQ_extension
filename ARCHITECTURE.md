# Eera Architecture

## Current foundation

Eera is a frontend-only Chrome extension. The production output in `dist/` is the loadable extension directory:

- `public/manifest.json` is copied to the output root.
- `index.html` is the React new-tab page and is used by `chrome_url_overrides`.
- `src/background/serviceWorker.js` is bundled to `background/serviceWorker.js`.
- `public/icons/` contains the PNG icon sizes referenced by the manifest.

Vite's Rollup inputs and output names are configured explicitly in `vite.config.js`; a standard single-page React build would not, by itself, ensure that the manifest's service-worker path exists.

## React application

`src/main.jsx` mounts `src/App.jsx` into `index.html`. The current `App` is deliberately a static placeholder. `src/index.css` loads Tailwind CSS and defines only base page styling. Feature components and assistant state will be introduced in later milestones.

## Manifest V3 responsibilities

The manifest declares a background service worker, new-tab override, and static extension icons. It requests no permissions. No content script is registered yet: adding one before it has a feature would expand the extension's page access without a current need.

### Background service worker

The current worker only listens for the install event. In later milestones it can coordinate extension events and route messages between extension contexts. It must be treated as event-driven: Chrome can suspend an MV3 service worker when it is idle, so it must not own long-lived in-memory state or be assumed to run continuously. Durable state, if later needed, must use an appropriate storage mechanism introduced with that feature.

### Content scripts

There is no content script in this milestone. When supported-page UI or controlled page interactions are implemented, content scripts should be scoped to only the required sites and should communicate through a defined message contract instead of embedding business logic in page code.

### New-tab page

The React application runs as the extension's new-tab page, an extension-controlled surface that works around Chrome's restrictions on injecting into internal pages. It is not a general-purpose content script and does not have host access to arbitrary websites.

## Extension communication

There is no message protocol yet. Future messages between the React page, background worker, and content scripts should use Chrome extension messaging, with validated message types and explicit responses/errors. The background worker should coordinate short-lived browser operations rather than act as a continuously running assistant process.

## Planned speech architecture

Speech recognition and speech synthesis are future features. Recognition should remain independent of command parsing/execution, and speech synthesis should be a separate service. Microphone access and browser support must be tested in the intended extension contexts before choosing an implementation.

An offscreen document is **not** selected for continuous speech recognition. Its feasibility, lifecycle behavior, permissions, and supported APIs must be tested in Chrome before deciding whether it belongs in the architecture.

## Planned command architecture

Future command input should pass through separate stages: speech/text input, parsing into a typed intent, centralized dispatch, and a modular command implementation. Browser actions must use explicit Chrome APIs or narrowly scoped content-script operations; arbitrary AI-generated JavaScript must never be executed.

Personality responses should remain data-driven and separate from command execution. Any AI integration is outside this milestone and must not introduce a paid service or backend without explicit product approval.

## Chrome extension constraints

- Manifest V3 background workers are event-driven and may be suspended.
- Chrome internal pages restrict script injection; the new-tab override is the chosen Eera surface for those pages.
- Content scripts have isolated execution contexts and only the permissions/host access granted to the extension.
- Extension permissions and host permissions should be added only when a milestone implements and tests the associated feature.
- Extension APIs are not available in a normal Vite development page; test Chrome-specific behavior using the built extension.

