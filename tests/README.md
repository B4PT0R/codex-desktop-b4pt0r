# Tests

- `unit/` valide les transformations de protocole, quotas et audio.
- `components/` valide le rendu React dans jsdom.
- `contract/` génère les schémas depuis le binaire `codex` installé et valide les requêtes réellement envoyées.
- `../electron/*.test.mjs` et `../electron-spike/*.test.mjs` valident le
  transport App Server, les préférences, le navigateur Playwright partagé et la
  transcription avec le runner Node natif.

Commandes : `npm test`, `npm run test:contract`, `npm run test:electron`.
