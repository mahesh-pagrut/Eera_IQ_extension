# Eera

Eera is a personal AI browser assistant being developed as a Chrome extension. The long-term goal is a friendly, conversational assistant that can help with browser tasks using voice and text.

The project has completed **Milestone 1: Project initialization and architecture**, **Milestone 2: Floating assistant UI**, and **Milestone 3: Orb animations and interaction states**. Eera displays the same floating assistant widget on its custom new-tab page and on normal HTTP/HTTPS webpages.

## Technology

- React and JavaScript (ES modules)
- Vite
- Tailwind CSS 4
- Chrome Extension Manifest V3

The project is frontend-only. It does not use a backend, database, paid API, or speech service.

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

The widget contains Eera's gradient orb, a greeting and readiness status, a voice-coming-soon note, and a placeholder transcript. The new-tab page and website content script reuse the same React components.

The orb has five visual states: **idle** (gentle breathing and aura), **listening** (expanding sound-wave rings), **processing** (rotating rainbow aura), **speaking** (stronger layered pulsing glow), and **error** (subtle warm warning pulse). These are visual states only; no microphone, speech, or assistant-processing behavior is implemented. The animations respect the operating system's reduced-motion preference.

On normal webpages, the content script creates a small extension-owned mount point and renders the widget inside an open Shadow DOM. Component styles are embedded into the content-script bundle, which keeps the page's styles from changing Eera and Eera's styles from leaking into the page. The script does not read page content, collect browsing information, or automate the page.

The manifest declares `http://*/*` and `https://*/*` host access and matching content-script patterns so Chrome can inject Eera on normal websites. These broad host patterns are required for an everywhere-on-the-web floating UI; they grant the ability to inject the extension UI, not a feature that reads website contents. Chrome may display a site-access prompt, and users can restrict the extension's site access in Chrome.

## Current features and limitations

- Replaces Chrome's new-tab page with the floating Eera assistant.
- Injects the same widget on normal HTTP and HTTPS pages using a Shadow DOM content script.
- Orb interaction opens and closes the assistant panel. State selection is available only in the Vite development page for animation review; it is not included in the production UI.
- Animations are illustrative only. Listening and speaking do not access the microphone or produce/represent live audio activity.
- No microphone access, speech recognition/synthesis, AI, command handling, or browser automation is implemented.
- Chrome website injection has not been manually verified as part of this implementation. See [DEVELOPMENT.md](./DEVELOPMENT.md) for the manual smoke test.
