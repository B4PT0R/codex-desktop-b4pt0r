# Codex Desktop Linux

Client Electron + React indépendant pour `codex app-server`, inspiré de la
famille de produits Codex.

## Lancer

Prérequis : Node.js 22.12 ou plus récent et le binaire `codex`, présent dans le
`PATH` et authentifié.

```bash
npm install
npm run electron:dev
```

Pour inspecter seulement l’interface simulée dans un navigateur :

```bash
npm run dev
```

Electron lance `codex app-server` et communique avec lui en JSON-RPC sur
stdin/stdout. Le renderer reste isolé : seuls les appels desktop explicitement
exposés par le preload sont accessibles.

## Préférences locales

Les préférences de l’interface sont conservées atomiquement dans
`~/.codex/codex-desktop-linux.json`. Ce fichier versionné contient notamment la
langue, l’apparence, le dernier espace de travail et la voix Realtime. Il reste
distinct de `~/.codex/config.toml`, qui appartient au backend Codex.

## Audio

- Le bouton micro capture la dictée avec MediaRecorder dans Chromium et transmet
  du WebM/Opus au service de transcription Codex.
- Le bouton onde ouvre une conversation Realtime v3 avec App Server via WebRTC.
- La conversation vocale utilise un thread éphémère dédié, séparé du thread
  textuel persistant, afin d’éviter les interruptions de quota observées sur les
  threads persistants.

Ces chemins ne nécessitent ni Python, ni FFmpeg, ni outil de capture PulseAudio
local. L’autorisation microphone reste contrôlée par Electron et par le système.
Realtime demeure une capacité App Server expérimentale et dépend de son
activation pour le compte connecté.

## Fonctionnalités principales

- messages Markdown/GFM avec formules LaTeX/KaTeX accessibles, raisonnement,
  plans et outils regroupés ;
- modèles, permissions, approbations et interruption de tours ;
- pièces jointes locales, historique, reprise et recherche des conversations ;
- quotas de compte, intégrations, apps, skills et serveurs MCP ;
- tray Linux, instance unique et lancement à la connexion ;
- Chromium open source géré pour l’automatisation et les artefacts ;
- dictée WebM/Opus et conversation Realtime v3.

## Vérifier et empaqueter

```bash
npm run check
npm test
npm run test:electron
npm run build
npm run electron:deb
```

Le paquet est produit sous `dist/codex-desktop-linux_0.2.1_amd64.deb`.

## Sandbox Ubuntu

Sur Ubuntu 24.04+, AppArmor peut bloquer les user namespaces nécessaires aux
commandes Codex exécutées avec Bubblewrap. Utilisez le profil ciblé décrit dans
[`docs/ubuntu-bubblewrap-apparmor.md`](docs/ubuntu-bubblewrap-apparmor.md), sans
désactiver la protection globalement.
