---
name: use-shared-browser
description: Use the visible Playwright browser shared by Codex Desktop Linux and the user. Trigger for opening or navigating web pages, inspecting rendered sites, interacting with browser UI, testing local web apps, reading browser state, or continuing work in a page the user already opened.
---

# Use the shared browser

Use the `playwright` MCP tools supplied by Codex Desktop Linux. They control the
same persistent Chromium window and tabs that the user sees.

## Route browser work

- Start with `browser_tabs` using `list` to inspect the current shared session.
- Reuse the current tab when the user refers to a page they already opened.
- Use `browser_navigate` or create a tab only when the task requires another
  page.
- Prefer accessibility snapshots and `browser_find` before interacting.
- Keep existing tabs open unless the user asks to close them.
- Ask for confirmation before submitting sensitive information or performing
  consequential actions.

## Respect this host

The OpenAI desktop app's built-in `@Browser`, Browser plugin, Computer Use
browser, Chrome extension path, and agent-browser runtime are not supported in
this client. Do not try to invoke, install, or configure them.

Do not install `playwright`, `@playwright/mcp`, Chromium, or a system browser.
Codex Desktop owns matching versions and exposes them through the configured
`playwright` MCP server.

If the Playwright MCP tools are unavailable, tell the user to enable **Web
Browser > Enable shared browser** in Codex Desktop settings and reload the
session. Do not silently switch to another browser automation stack.
