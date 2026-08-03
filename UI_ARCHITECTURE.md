# Architecture UI

Ce document décrit l’architecture produit stabilisée de Codex Desktop Linux.
Il fixe les responsabilités des surfaces, la propriété des états et les
invariants d’interaction. L’historique des migrations appartient au changelog et
à Git ; la couverture détaillée du protocole appartient à
`APP_SERVER_COVERAGE.md`.

## Principes

- Le fil de conversation montre l’intention, les décisions et le résultat, pas
  une transcription brute du protocole.
- App Server reste la source de vérité pour les threads, tours, catalogues,
  permissions, comptes et capacités. Les états clients servent uniquement la
  présentation ou une préférence explicitement possédée par l’application.
- Les actions fréquentes restent dans leur contexte. Les détails volumineux
  utilisent la divulgation progressive ou le panneau de travail.
- Les réglages persistants globaux vivent dans Settings ; les réglages effectifs
  du thread restent près du compositeur.
- Une capacité absente ou expérimentale échoue proprement. L’interface ne simule
  pas une mutation qu’App Server n’expose pas.
- L’application reste utilisable au clavier, à la largeur minimale configurée et
  sous les facteurs d’échelle Linux courants.

## Shell de l’application

```text
┌──────────────────┬────────────────────────────────┬──────────────────────┐
│ Navigation       │ Conversation                   │ Panneau de travail   │
│                  │                                │ repliable            │
│ Nouveau thread   │ En-tête du thread              │ Diff / média /       │
│ Recherche        │ Messages et activité           │ aperçu contextuel    │
│ Projets/threads  │                                │                      │
│                  │ Compositeur                    │                      │
│ Compte/Settings  │ Barre de session               │                      │
└──────────────────┴────────────────────────────────┴──────────────────────┘
```

La navigation, la conversation et le panneau de travail sont trois régions
autonomes. À largeur réduite, la navigation se replie et le panneau de travail
devient superposé ; la conversation n’est jamais comprimée entre trois colonnes.
Settings remplace temporairement l’espace de travail plutôt que de s’ouvrir dans
une grande modale.

## Propriété des états

### Frontière native

`electron/` possède le processus App Server, le tray, les fenêtres, les fichiers
bornés, les préférences desktop, les mises à jour, l’audio et le Chromium
partagé. Le renderer n’accède à ces fonctions qu’à travers le preload et des IPC
spécialisés.

Le transport App Server survit à un rechargement du renderer. Electron conserve
l’état du handshake initial ; chaque session frontend utilise ses propres
identifiants de requête afin qu’une réponse tardive ne puisse pas atteindre une
nouvelle WebView.

### Frontière protocolaire

`src/lib/codex.ts` possède le cycle de vie JSON-RPC et
`src/lib/protocol.ts` la construction et la normalisation des payloads. Les hooks
de domaine transforment les événements App Server en modèles de présentation ;
les composants ne devinent pas les formes du fil.

Les événements portant un `threadId` ne modifient que leur propriétaire. Le
thread visible est réhydraté depuis App Server au retour ; l’interface ne garde
pas une copie complète de chaque transcript actif.

### État client

Les préférences purement desktop sont persistées par Electron dans
`~/.codex/codex-desktop-linux.json`. La configuration officielle reste dans
`config.toml`. Les états de brouillon, focus, ouverture et animation restent
locaux à la surface qui les rend.

Toute mutation asynchrone définit son propriétaire, sérialise les opérations
incompatibles et invalide les lectures antérieures. Une réponse obsolète ne peut
ni restaurer un choix remplacé, ni ressusciter un élément supprimé.

## Surfaces principales

### Navigation

La sidebar crée, recherche, reprend et organise les conversations par workspace.
La page récente reste bornée ; la recherche interroge l’historique persistant.
Les groupes fonctionnent comme un accordéon, sauf pendant une recherche où tous
les groupes pertinents peuvent être ouverts.

La conversation par défaut possède une section compacte dédiée et n’est pas
dupliquée dans son groupe de workspace. Les indicateurs se limitent aux états
actionnables : activité, erreur et sélection.

### En-tête du thread

L’en-tête porte l’identité du thread et son objectif autonome. Son menu regroupe
renommage, fork, compaction, archivage, suppression confirmée et édition du
`AGENTS.md` du workspace. Les contrôles de modèle ou de sécurité n’y sont pas
dupliqués.

### Conversation

Le fil rend les messages, raisonnements résumés, plans, outils, approbations,
questions, avertissements, diffs et médias avec des traitements distincts. Les
erreurs de l’application utilisent une carte d’alerte et ne se présentent jamais
comme une réponse de l’agent.

Les outils d’une même vague partagent un groupe stable. Les cartes restent
repliables et les jobs de fond conservent leur statut sans bloquer visuellement
les actions suivantes. Un `agentMessage` explicitement classé `commentary`,
court et immédiatement suivi d’un outil devient l’intitulé principal de cette
carte ; le type d’action reste affiché en second. Les phases finales, inconnues
ou les narrations longues restent des messages afin de ne pas inventer une
association absente du protocole. Les sous-agents sont des actions ordinaires
dont le détail contient un transcript enfant borné et réhydratable.

L’historique est paginé. Les deltas fréquents sont regroupés dans des mises à
jour React interruptibles ; le compositeur, les demandes bloquantes et la
navigation gardent la priorité.

### Compositeur et barre de session

Le compositeur accepte texte, images, références de fichiers, Apps, Skills,
dictée et commandes reconnues. Il envoie un nouveau tour, dirige un tour actif
ou l’interrompt selon l’état autoritaire du thread.

La barre de session expose les réglages fréquents et effectifs : modèle, effort,
tier de service, collaboration, permissions et approbations. Les quotas et le
contexte restant restent des indicateurs discrets, pas un second panneau de
réglages.

### Panneau de travail

Les résumés de commandes et changements restent dans le fil. Une ressource qui
demande une lecture persistante — diff, image, PDF, HTML ou aperçu pris en
charge — peut s’ouvrir dans le panneau de travail. Le panneau ne duplique pas un
inspecteur permanent vide et devient superposé à faible largeur.

Les commandes réellement persistantes utilisent une surface inférieure dédiée,
distincte du panneau contextuel.

## Settings

Settings est une vue dédiée avec retour à l’application, recherche, navigation
catégorisée et contenu scrollable. Ses sections configurent des préférences
globales :

1. **Application** — General, Account & Usage, Appearance & Display, Remote
   Control ;
2. **Agents & Capabilities** — Agents, Permissions, Web, Voice, Memory,
   Scheduler ;
3. **Extensions** — Skills, Apps, MCP Servers, Plugins, Hooks ;
4. **Advanced** — Configuration, Import from Another Agent.

La navigation Settings défile indépendamment et conserve une taille de cible
confortable. Ses catégories sont sémantiques et se masquent lorsqu’une recherche
n’en conserve aucun élément.

### Primitives communes

- `SettingsPageHeader` possède le titre, la description, le badge de portée et
  le séparateur de page. Les actions opérationnelles n’y vivent pas.
- `SettingsControlsBar` attache statut et actions rapides à la liste ou carte
  qu’ils pilotent.
- `IconSubheader` introduit un groupe sans créer de carte ni de séparateur.
- `Note` porte une recommandation éditoriale ; `Alert` porte un état
  opérationnel avec ton et rôle accessibles.
- `IconCard` définit icône, hiérarchie titre/sous-titre, détail et widgets de
  droite. Sa variante compacte sert aux grands inventaires.
- `CardStack` possède contour, fond, coins, ombre et séparateurs d’un groupe de
  cartes ainsi qu’une barre de contrôle facultative.
- Les groupes génériques de champs composent `CardStack` avec la classe de
  disposition `settings-fields`; seuls les panneaux métier autonomes gardent
  une enveloppe spécifique.
- `RoundIcon` et `IconButton` centralisent géométrie, niveaux visuels,
  libellés et états désactivés des actions compactes.
- `IconToggle` porte les bascules non natives et `Badge` les étiquettes
  non interactives; tailles, variantes et tons restent définis dans
  `primitives.css` plutôt que dans les features.

Les styles de feature décrivent uniquement les widgets et états métier. Ils ne
reconstruisent ni carte, ni bouton, ni palette par thème. Le bloc titre d’une
`IconCard` cède l’espace avec ellipse ; les widgets restent utilisables et sont
bornés à deux tiers de la largeur.

### Extensions

Les inventaires sont relus depuis App Server après chaque mutation. Aucun cache
client n’est présenté comme autoritaire.

- **Skills** : `skills/list` et `skills/config/write` gouvernent découverte et
  activation. La création guidée passe par un IPC borné à un nouveau
  `SKILL.md` personnel ou de workspace.
- **Apps** : l’inventaire distingue état accessible, installé et callable. Les
  défauts globaux et politiques par App/outils écrivent la configuration typée.
  Le catalogue consomme la pagination sous limites défensives, puis combine
  recherche, catégorie et index alphabétique. Une connexion ouvre uniquement
  l’`installUrl` HTTP(S) fourni par App Server.
- **MCP** : l’ajout guidé expose les champs courants puis les options avancées
  utiles, directement traduites vers `mcp_servers`. Les réglages rares restent
  dans `config.toml`. La suppression n’est proposée que pour une table utilisateur
  modifiable ; OAuth et startup restent App Server-owned.
- **Plugins** : `plugin/installed` expose l’inventaire effectif avec provenance,
  version et politiques. L’activation écrit `plugins.<id>` via
  `config/value/write`, comme la CLI officielle, puis recharge les capacités
  dépendantes. Le catalogue complet reste annoncé sans action tant que
  `plugin/list`, `plugin/read`, l’installation et la désinstallation sont
  interdits aux clients de production.
- **Hooks** : l’interface expose origine, confiance et commande effectives sans
  inventer d’API d’édition.

Les Apps et Skills sont envoyées au compositeur sous leurs formes structurées
App Server. Aucun override persistant par thread n’est présenté sans contrat de
mutation correspondant.

## Navigateur partagé et liens

L’application ne contient pas une seconde WebView générale. Après activation
explicite, elle télécharge le Chromium correspondant aux versions embarquées de
Playwright et Playwright MCP dans les données utilisateur de l’application.
Electron possède le processus, le profil persistant, le serveur MCP loopback et
la récupération d’un processus résiduel strictement identifié.

L’UI et App Server se connectent au même contexte visible. La session MCP de
l’UI maintient son flux d’événements, répond aux heartbeats et refait une fois le
handshake si Playwright expire la session. En cas d’indisponibilité, les liens
HTTP(S) utilisent le navigateur système.

Le client désactive localement les capacités Browser/Computer Use officielles
qui entreraient en concurrence avec ce parcours, sans modifier `config.toml`.
La Skill embarquée `use-shared-browser` est enregistrée comme racine en lecture
seule propre au client.

Les liens du transcript passent par un routeur explicite. Les chemins de fichiers
sont canonicalisés par Electron puis ouverts sans construire de commande shell ;
les protocoles inconnus et chemins absents sont refusés avec une erreur visible.

## Realtime, tray et Scheduler

Realtime crée un fork vocal éphémère et injecte les échanges finalisés dans le
parent persistant dans l’ordre. Le hook de domaine possède les deltas, la
finalisation, l’injection et tous les chemins d’arrêt. Une session lancée depuis
le tray garde le renderer caché vivant ; montrer la fenêtre rattache la
présentation sans recréer la session WebRTC.

Le Scheduler persiste des tâches ponctuelles, périodiques ou hebdomadaires et
cible le thread courant, le thread par défaut, un nouveau thread ou un thread
éphémère. Les tours sont sérialisés par cible. Une tâche sans surveillance
applique Full Access/Never Ask uniquement pendant son exécution puis restaure
l’état capturé avant de libérer la file.

Les outils dynamiques Scheduler sont enregistrés uniquement sur les nouveaux
threads textuels compatibles. Suppression et opérations destructives attendent
une confirmation UI. La fermeture de fenêtre conserve les tâches dans le tray ;
quitter l’application interrompt explicitement le travail en cours.

## Lifecycle natif et mises à jour

Electron sonde le transport JSON-RPC, pas seulement l’existence du processus.
Une défaillance confirmée remplace App Server ; le renderer réattache ses
listeners, recharge les catalogues et réhydrate le thread visible avant que le
Scheduler ne réclame de nouveau travail.

Les releases stables du client et de Codex CLI sont sondées au démarrage puis
toutes les heures. Chaque version plus récente apparaît comme une action
compacte distincte dans la top bar et sur sa propre ligne de version dans
General. Le minimum CLI compatible est embarqué dans les métadonnées de release
du client ; une installation trop ancienne reste visible comme état dégradé.
La mise à jour CLI délègue exclusivement à `codex update`, puis demande de
redémarrer App Server au lieu de deviner le gestionnaire d’installation.

Pour le client, le processus natif détecte AppImage ou la famille de
distribution via `/etc/os-release`, sélectionne uniquement l’artefact de même
format et architecture, puis valide URL GitHub, taille et SHA-256. Seul le DEB
suit l’installation Polkit/APT après validation de ses métadonnées. RPM,
AppImage et familles inconnues ouvrent la release validée sans exécuter
d’installation privilégiée.

Installation, mise à jour et démarrage ne réécrivent pas les préférences,
`config.toml` ou les métadonnées de thread sans action explicite ou migration
documentée.

## Responsive, thèmes et accessibilité

- Le shell, Settings et les modales restent utilisables à la taille minimale et
  avec les textes localisés longs.
- Les colonnes de widgets ne sont jamais rognées ; le texte secondaire cède
  l’espace et utilise l’ellipse lorsque nécessaire.
- Les thèmes clair et sombre partagent les mêmes primitives et contrastes
  sémantiques. Les bordures utilisent des gris discrets, jamais un noir hérité.
- Les dialogues gèrent focus initial, piège de focus, fermeture clavier et
  restauration. Les actions portent des noms accessibles et les états ne sont
  pas communiqués par la couleur seule.
- Toute modification visuelle est contrôlée par des captures avant/après
  comparables et, lorsqu’elle est matérielle, actualise `screenshots/`.

## Carte des capacités

| Domaine | Surface principale | Convention |
| --- | --- | --- |
| Threads et tours | Navigation, en-tête, conversation | Produit principal, état isolé par thread |
| Modèles et collaboration | Barre de session, Settings | Contrôles fréquents près du thread |
| Permissions et approbations | Barre de session, Settings, dialogues | Choix explicites, jamais coercitifs |
| Outils, commandes et fichiers | Conversation, panneau de travail | Résumé inline, détail progressif |
| Apps, Skills, MCP, Plugins, Hooks | Settings, compositeur | Inventaires App Server-owned |
| Compte, quotas et messages | Account, indicateurs discrets | Portée globale |
| Realtime | Compositeur, conversation, tray | Fork éphémère et parent persistant |
| Scheduler | Settings, cartes de réveil | File par thread et sécurité restaurée |
| Configuration | Settings, éditeurs bornés | Guidage courant et échappatoire TOML |
| Web et médias | Panneau de travail, fenêtre Chromium | Contexte Playwright partagé |
| FS, process et transport | Infrastructure native | Aucune console RPC générique |

## Exclusions intentionnelles

- Pas de navigateur général embarqué ni de concurrence entre Chromium partagé
  et Browser/Computer Use officiel.
- Pas de console brute pour JSON-RPC, filesystem ou processus.
- Pas de mutation marketplace Plugins avant stabilisation officielle.
- Pas de réglage par thread inventé lorsque seul un état effectif en lecture est
  disponible.
- Pas de dépendance à un gestionnaire de paquets particulier hors du parcours
  explicitement détecté.
