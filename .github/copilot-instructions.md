# Copilot Instructions for Eera

## Purpose and vision

Eera is a friendly, conversational personal assistant for the Chrome browser. The long-term vision includes voice interaction and carefully controlled browser tasks. Implement only the milestone the user has explicitly approved; do not build future features early.

## Technology stack

- React, Vite, Tailwind CSS, and custom CSS.
- JavaScript with ES modules. **Use JavaScript only; do not introduce TypeScript.**
- Chrome Extension Manifest V3 and Chrome extension APIs.
- Keep the initial application frontend-only. Do not add a backend, database, paid API, or unnecessary dependency without explicit approval.

## Architecture and component responsibilities

- Keep UI components reusable and focused on presentation and interaction.
- Keep browser API access, business logic, speech services, parsing, and command execution in separate modules.
- Keep speech recognition independent from command execution.
- Keep personality responses in extensible data files.
- Route future browser commands through a centralized dispatcher and modular command implementations.
- Add content scripts only for supported-page features that need them, with the narrowest practical match patterns.
- Treat the MV3 service worker as event-driven; Chrome may suspend it while idle.
- Do not assume an offscreen document is suitable for continuous speech recognition until tested in Chrome.
- Never execute arbitrary AI-generated JavaScript.

## Coding conventions

- Use clear, descriptive names: PascalCase for React components, camelCase for functions and variables, and concise lower-case module/file names consistent with existing files.
- Prefer small modules with one responsibility and reuse existing helpers/patterns before introducing abstractions.
- Preserve accessibility, responsive behavior, and the project's existing formatting.
- Avoid unexplained comments; document non-obvious decisions where useful.

## Error handling and security

- Handle asynchronous and Chrome API failures explicitly. Do not silently swallow errors or return success-shaped fallbacks.
- Validate inputs and messages at trust boundaries.
- Request only the Chrome permissions required by the implemented milestone; avoid broad host permissions.
- Do not inject or evaluate arbitrary code in web pages.
- Keep secrets and credentials out of source, logs, and committed files.

## Documentation

- Keep `README.md` aligned with actual setup, build, and loading behavior.
- Record architecture and Chrome lifecycle constraints in `ARCHITECTURE.md`.
- Update `DEVELOPMENT.md` after each completed milestone, including status, affected files, testing requirements, and known issues.
- Explain the reason before making significant architectural changes.

## Milestone workflow

- Work only on the current milestone and stop when it is complete.
- Do not implement future milestones without explicit instruction.
- Before completion, run the smallest relevant validation, including a production build when build configuration changes.
- Verify generated extension entry points and referenced assets; do not claim Chrome behavior is verified unless it was tested in Chrome.
