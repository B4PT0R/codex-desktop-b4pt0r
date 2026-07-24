# Codex Desktop Linux

Client desktop Tauri + React pour `codex app-server`, inspiré de l’extension Codex pour VS Code.

## Lancer

Prérequis Ubuntu : Node 20+, Rust et les dépendances système Tauri (`libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`). Le binaire `codex` doit être présent dans le `PATH` et authentifié.

```bash
npm install
npm run tauri dev
```

Pour inspecter seulement l’interface dans un navigateur :

```bash
npm run dev
```

Le mode navigateur simule une réponse. Le mode Tauri lance `codex app-server` et communique avec lui en JSON-RPC sur stdin/stdout.

## Préférences locales

Les préférences propres à l’interface sont conservées dans
`~/.codex/codex-desktop-linux.json`. Ce fichier versionné contient actuellement la
langue de l’interface et le dernier espace de travail. Il est distinct de
`~/.codex/config.toml`, qui reste sous la responsabilité du backend Codex.

L’application écrit ce JSON atomiquement avec des permissions restrictives. Les
anciennes valeurs WebKit sont migrées automatiquement lors du premier lancement de
la version native correspondante.

## Fonctionnalités

- streaming des messages Markdown et rendu GFM ;
- appels d’outils regroupés dans des expanders ;
- sélection du modèle et permissions ;
- demandes d’approbation natives à l’interface ;
- pièces jointes locales (images) dans le composer ;
- commandes `/clear`, `/review` et `/status` ;
- limites de compte 5 h / 7 j réelles ;
- historique récent et reprise des conversations ;
- interruption d’un tour en cours ;
- tray Linux, instance unique et démarrage automatique à la connexion ;
- fermeture de la fenêtre vers le tray et arrêt explicite depuis « Quitter » ;
- conversation vocale Codex Realtime via WebRTC, avec transcription en direct et audio retour.

Realtime est une API app-server expérimentale. Elle nécessite l’accès au modèle Realtime pour le compte connecté et l’autorisation micro du système.

## Construire le paquet Debian

```bash
npm run tauri build -- --bundles deb
```

Le paquet est produit sous `src-tauri/target/release/bundle/deb/`. Le réglage
« Lancer Codex à la connexion » dans Général contrôle l’entrée sous
`~/.config/autostart/`. Lorsqu’il est actif, l’application démarre masquée, reste
accessible depuis le tray et initialise la connexion App Server.

## Sandbox Ubuntu

Sur Ubuntu 24.04+, AppArmor peut bloquer les user namespaces nécessaires à Bubblewrap. Utilisez le profil ciblé et la procédure décrits dans [`docs/ubuntu-bubblewrap-apparmor.md`](docs/ubuntu-bubblewrap-apparmor.md), sans désactiver la protection globalement.
