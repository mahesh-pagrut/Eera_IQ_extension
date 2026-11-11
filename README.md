# Eera

Eera is a personal AI browser assistant being developed as a Chrome extension. The long-term goal is a friendly, conversational assistant that can help with browser tasks using voice and text.

This repository currently contains **Milestone 1: Project initialization and architecture**. The new-tab page is a small React placeholder; no assistant actions are implemented yet.

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

## Load in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Choose **Load unpacked**.
5. Select this project's `dist` directory.
6. Open a new tab to view Eera's placeholder page.

After rebuilding, use **Reload** on the extension card in `chrome://extensions` to load updated output.

## Current features and limitations

- Replaces Chrome's new-tab page with a simple React placeholder.
- Includes the minimum MV3 background service-worker entry and extension icons.
- Requests no Chrome permissions.
- Does not yet include content scripts, voice input/output, microphone access, AI integration, command handling, or browser automation.
- Chrome behavior has not been runtime-tested as part of this milestone. See [DEVELOPMENT.md](./DEVELOPMENT.md) for the next milestone's testing requirements.

