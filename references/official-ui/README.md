# Référence visuelle — application Codex Desktop

Ce dossier conserve un relevé local de l’interface Codex Desktop officielle afin
de guider l’ergonomie de Codex Desktop Linux sans devoir relancer régulièrement
l’application Electron de référence.

## Provenance

- Source : checkout `~/dev/codex-desktop-linux-official`.
- Nature : port Linux non officiel du binaire Electron Codex Desktop officiel.
- Capture : 19 juillet 2026, fenêtre 1280 × 820.
- Usage : inspiration visuelle et organisationnelle uniquement. Ne pas copier le
  code minifié, les textes propriétaires en masse ou présenter notre client comme
  une application officielle OpenAI.

Le sous-dossier [`2026-07-19`](./2026-07-19/) contient les images originales et
[`00-contact-sheet.jpg`](./2026-07-19/00-contact-sheet.jpg) fournit une vue
d’ensemble rapide.

## Index

### Shell principal

- `01-home-new-chat.png` — accueil, navigation globale, suggestions et compositeur.
- `02-product-switcher.png` — switcher ChatGPT/Codex dans l’en-tête de sidebar.
- `19-thread-conversation.png` — conversation réelle, résumé, commande et carte de
  changement avec action Review.
- `20-thread-side-panel.png` — panneau latéral contextuel repliable ; le fil se
  redimensionne au lieu d’être recouvert.
- `21-pull-requests.png` — surface Pull Requests de premier niveau.
- `22-scheduled.png` — tâches planifiées, recherche et suggestions.
- `23-plugins-home.png` — catalogue Plugins de premier niveau.
- `24-thread-header-actions.png` — actions d’en-tête autour du thread, de l’ouverture
  du projet et de la création de pull request.
- `25-composer-add-menu.png` — menu `+` unifié : fichiers, compétences et plugins.
- `26-approval-mode-menu.png` — niveaux d’autonomie expliqués dans le compositeur.
- `27-model-picker.png` — sélecteur compact de modèle et réglage d’effort.

### Réglages personnels

- `03-settings-general.png` — permissions et préférences générales.
- `04-settings-profile.png` — profil et état de chargement.
- `05-settings-appearance.png` — thème, exemples visuels et couleurs.
- `06-settings-voice.png` — dictée/voix.
- `07-settings-configuration.png` — configuration Codex et modes d’approbation.
- `08-settings-personalization.png` — personnalité, instructions et mémoire.
- `09-settings-keyboard-shortcuts.png` — raccourcis recherchables.
- `10-settings-usage-billing.png` — plan, crédits et barres d’utilisation.

### Intégrations et code

- `11-settings-plugins.png` — gestion des plugins.
- `12-settings-browser.png` — activation et réglages navigateur.
- `13-settings-computer-use.png` — connexion du backend Computer Use.
- `14-settings-hooks.png` — état vide des hooks.
- `15-settings-connections.png` — onglets de contrôle distant/SSH.
- `16-settings-git.png` — branches, commit, instructions et pull requests.
- `17-settings-environments.png` — environnements MCP/projet.
- `18-settings-worktrees.png` — isolation et règles de worktree.

## Conventions à reprendre

- Les réglages remplacent l’espace de travail dans une vue dédiée, avec un bouton
  de retour, une recherche et une navigation groupée.
- Les catégories peuvent être nombreuses sans encombrer la sidebar principale.
- Une ligne de réglage associe un titre, une explication courte et un contrôle à
  droite ; les groupes utilisent des cartes sobres.
- Les commandes, tests et changements restent résumés dans le fil. Le panneau
  latéral sert aux contenus contextuels persistants, pas à une télémétrie permanente.
- Le modèle et le mode d’approbation restent proches du compositeur.
- Les Plugins gagnent un accès global lorsque leur catalogue devient une activité
  quotidienne ; leur configuration détaillée reste dans les réglages.
- Les actions avancées sont révélées par domaine plutôt que rassemblées dans une
  page technique générique.

## Adaptations pour notre client

- Notre première version garde moins d’entrées globales : pas de Pull Requests ou
  Scheduled tant que les parcours correspondants ne sont pas réellement utiles.
- Les catégories futures sont visibles dans la vue de réglages avec un état
  explicite « Prévu », sans faux interrupteur ni action inerte.
- Le panneau latéral sera introduit seulement avec un premier contenu réel (diff,
  navigateur ou ressource MCP), pas comme une colonne vide.
- Le vocabulaire et les comportements restent adaptés à Linux/Tauri et au périmètre
  App Server disponible.
