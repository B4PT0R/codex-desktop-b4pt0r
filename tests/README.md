# Tests

- `unit/` valide les transformations de protocole, quotas et audio.
- `components/` valide le rendu React dans jsdom.
- `contract/` génère les schémas depuis le binaire `codex` installé et valide les requêtes réellement envoyées.
- Les tests Rust restent dans `src-tauri` et se lancent avec `npm run test:native`.

Commandes : `npm test`, `npm run test:contract`, `npm run test:native`.
