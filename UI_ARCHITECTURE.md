# Architecture UI cible

Ce document fixe la structure produit avant d’étendre davantage l’intégration
App Server. Il sert de guide de migration : une capacité du protocole ne doit pas
être ajoutée à l’endroit le plus facile techniquement, mais à la surface qui lui
donne un sens pour l’utilisateur.

L’objectif n’est pas d’exposer chaque méthode JSON-RPC. Les méthodes de transport,
de lecture de fichiers ou d’exécution peuvent soutenir une expérience sans devenir
des boutons génériques dans l’interface.

## Principes de structure

- Le fil reste la surface principale. Il montre l’intention, les décisions et le
  résultat, pas toute la télémétrie disponible.
- Les actions fréquentes restent à un clic du contexte où elles s’appliquent.
- Les détails volumineux ou spécialisés utilisent une divulgation progressive ou
  un inspecteur, jamais une succession de modales.
- Les réglages distinguent les préférences globales des réglages du thread courant.
- Une surface future peut être représentée dans la navigation pour valider
  l’architecture, mais elle doit être étiquetée comme indisponible tant que son
  comportement réel n’est pas branché.
- Les capacités expérimentales restent regroupées et ne dictent pas la navigation
  principale.

## Shell cible

```text
┌──────────────────┬────────────────────────────────┬──────────────────────┐
│ Navigation       │ Conversation                   │ Panneau contextuel   │
│                  │                                │ (repliable)          │
│ Nouveau chat     │ En-tête du thread              │ Diff / aperçu / web  │
│ Recherche        │ Messages / activité            │ selon l’action       │
│ Projets/threads  │                                │                      │
│                  │ Compositeur                    │                      │
│ Espace de travail│ Barre de session               │                      │
│ Compte/Réglages  │                                │                      │
└──────────────────┴────────────────────────────────┴──────────────────────┘
```

À largeur réduite, le panneau contextuel devient superposé. La conversation ne
descend jamais sous trois colonnes comprimées.

### 1. Navigation globale

Responsabilités :

- créer, rechercher, reprendre et organiser les conversations ;
- regrouper les threads par espace de travail ;
- montrer uniquement les états nécessitant une lecture rapide : actif, erreur ;
- ouvrir le sélecteur d’espace de travail, le compte et les réglages.

App Server : `thread/list`, `thread/search`, `thread/start`, `thread/resume`,
`thread/archive`, `thread/unarchive`, `thread/status/changed`,
`thread/name/updated`. La page récente reste bornée tandis que la recherche interroge
l’historique persistant complet et présente les extraits correspondants.

### 2. En-tête du thread

Responsabilités :

- identité du thread et état de connexion ;
- objectif autonome persistant, progression et budget facultatif ;
- menu contextuel : renommer, créer une branche, compacter, archiver ;
- actions destructrices séparées : supprimer avec confirmation ;
- ouvrir ou fermer le panneau contextuel.

App Server : `thread/name/set`, `thread/fork`, `thread/compact/start`,
`thread/archive`, `thread/delete`, `thread/goal/*`. Le `thread/rollback` déprécié
n’est pas prévu.

### 3. Conversation

Responsabilités :

- messages utilisateur et agent ;
- raisonnement résumé, plan, revue et avertissements ;
- outils sous forme de résumés compacts avec détails repliables ;
- demandes bloquantes : approbations et questions ;
- historique paginé et états streaming/échec/interruption.

App Server : `turn/*`, `item/*`, `review/start`, demandes serveur, warnings,
compaction, collaboration et outils MCP.

### 4. Compositeur et barre de session

Responsabilités :

- texte, images/fichiers, mentions et audio ;
- commandes shell locales préfixées par `!`, toujours confirmées car exécutées sans
  sandbox sur l’hôte App Server ;
- envoyer, diriger un tour actif et interrompre ;
- accès rapide au modèle, mode de travail et profil de permissions ;
- contexte restant et reroutage de modèle sans polluer le fil ;
- palette de commandes issue des capacités réellement disponibles.

App Server : `turn/start`, `turn/steer`, `turn/interrupt`, Realtime,
`thread/settings/update`, `model/list`, `permissionProfile/list`,
`thread/tokenUsage/updated`, `model/rerouted`, `thread/shellCommand`, recherche floue
de fichiers.

### 5. Détails de travail et panneau contextuel

L’app officielle conserve les résumés de commandes et de changements directement
dans le fil, avec des actions telles que « Review ». Un bouton d’en-tête ouvre un
panneau latéral générique quand une ressource mérite une surface persistante. Nous
reprenons cette organisation plutôt que d’inventer un inspecteur permanent à trois
onglets.

- changements, plan et commandes restent résumés dans le fil ;
- « Revoir » ouvre le diff dans le panneau contextuel ;
- navigateur, ressource MCP ou aperçu peuvent réutiliser le même panneau ;
- un futur terminal persistant utilise un panneau inférieur distinct, comme la
  convention prévue dans les réglages de l’app officielle ;
- contexte et modèle effectif restent dans la barre de session et les détails du
  thread, sans onglet permanent vide.

Le panneau contextuel devient la vue persistante quand les détails dépassent une
carte, sans dupliquer systématiquement le contenu du fil.

App Server : `turn/diff/updated`, `item/fileChange/*`, `command/exec/*`,
`process/*`, `review/start`, token usage, instructions et environnement du thread.

### 6. Centre de réglages

L’app officielle utilise une vue dédiée qui remplace temporairement l’espace de
travail, avec « Retour à l’app », recherche, groupes de navigation et contenu
scrollable. Cette structure est retenue à la place d’une grande modale.

Le centre utilise une navigation interne durable :

1. **Général** — apparence, démarrage, notifications, comportement de fenêtre ;
2. **Agent et modèles** — modèle, effort, personnalité, modes de collaboration ;
3. **Permissions** — profils, approbations et exigences administrées ;
4. **Intégrations** — MCP, apps/connecteurs, plugins, skills et hooks ;
5. **Compte et utilisation** — connexion, quotas, consommation et messages ;
6. **Avancé** — fonctions expérimentales, import d’autres agents, contrôle distant,
   diagnostics et feedback.

État actuel : les inventaires stables `skills/list`, `mcpServerStatus/list` et
`hooks/list` sont branchés, ainsi que l’activation des skills et la connexion OAuth
MCP complète. Les hooks effectifs du projet restent volontairement en lecture seule :
leur origine, confiance et commande sont consultables, sans simuler une API de mutation.
Les apps accessibles et activées de
`app/list` apparaissent dans les réglages et peuvent être ajoutées au compositeur
comme mentions structurées `app://`; le catalogue complet n'est pas chargé dans
la navigation quotidienne. Le catalogue et l’installation de
plugins restent isolés tant que la documentation officielle les interdit aux
clients de production.

Les profils nommés de `permissionProfile/list`, les presets de
`collaborationMode/list`, l’identité `account/read` et l’activité
`account/usage/read` alimentent également leurs réglages respectifs. Les actions
de connexion/déconnexion restent séparées de cette vue informative afin qu’un
simple passage dans les réglages ne puisse pas modifier le compte.

Les tickets gagnés de `account/rateLimits/read` apparaissent uniquement quand le
backend les annonce. Leur consommation demande une confirmation, utilise une clé
idempotente et relit ensuite les quotas ; aucun ticket absent n’est simulé dans
l’interface.

Les messages actifs de `account/workspaceMessages/read` restent dans cette surface
globale, bornés aux vingt plus récents. L’e-mail au propriétaire n’est proposé que
si `rateLimitReachedType` signale explicitement des crédits workspace épuisés ou
une limite workspace atteinte ; un simple quota personnel ne déclenche pas cette
action.

Les valeurs du thread courant apparaissent dans « Agent et modèles » et
« Permissions » avec une indication explicite de leur portée. Les préférences
globales ne doivent pas être sauvegardées implicitement comme réglages du thread.

La connexion ChatGPT gérée par Codex ouvre le navigateur système, conserve le
`loginId` pour permettre réouverture et annulation, et attend la notification de
fin avant de relire le compte. La déconnexion d’une identité gérée est confirmée ;
les identifiants Bedrock externes restent administrés hors de l’application.

## Carte des capacités

| Domaine App Server                | Surface principale                      | Traitement UI                           |
| --------------------------------- | --------------------------------------- | --------------------------------------- |
| Threads et tours                  | Navigation, en-tête, conversation       | Produit principal                       |
| Modèles et collaboration          | Barre de session, réglages              | Contrôles fréquents + détail            |
| Permissions et approbations       | Barre de session, réglages, dialogue    | Choix explicites et sûrs                |
| Outils, commandes et fichiers     | Conversation, panneau contextuel        | Résumé inline, détail persistant        |
| Revue                             | Carte de changement, panneau contextuel | Flux guidé, pas un réglage              |
| MCP, apps, plugins, skills, hooks | Réglages Intégrations, mentions         | Catalogue et état de connexion          |
| Compte, quotas, usage, messages   | Réglages Compte, indicateurs discrets   | Global, jamais mélangé au contexte      |
| Realtime                          | Compositeur                             | Action directe, état temporaire         |
| Configuration                     | Réglages par domaine                    | Pas d’éditeur TOML générique par défaut |
| Expérimental et import            | Réglages Avancé                         | Isolé et clairement signalé             |
| FS, process, exec, ressources MCP | Infrastructure/panneaux                 | Pas de console RPC générique            |
| Warnings, diagnostics, feedback   | Conversation ou Avancé selon portée     | Actionnable, dédupliqué                 |

Les workflows navigateur ne chargent pas une seconde WebView générale dans le
shell Electron. Une instance Chromium open source indépendante (pas Google Chrome ou
Microsoft Edge) porte l’automatisation et son
isolation de processus ; le client n’affiche que son état, ses actions et ses
résultats dans les cartes ou le panneau contextuel. Cette même instance sert de
visualiseur plein format par défaut pour les images, PDF, HTML et autres médias
compatibles, à partir des aperçus légers du fil. Son profil, son cycle de vie et sa
récupération après crash appartiennent à la couche native. Le navigateur système
reste un repli explicite lorsqu’aucun Chromium géré n’est disponible.

La couche native recherche d’abord un Chromium open source compatible déjà installé. En son
absence, le client présente la dépendance et demande une confirmation explicite
avant de lancer une installation adaptée à la distribution. Il n’élève jamais les
droits, ne modifie pas les sources de paquets et n’installe rien silencieusement ;
l’interface rend visibles progression, annulation, erreur et nouvelle détection.
Google Chrome et Microsoft Edge ne satisfont pas la détection normale. Un override
`CODEX_CHROMIUM_EXECUTABLE` reste réservé aux besoins avancés de compatibilité avec
une éventuelle évolution de l’automation officielle.

## Audit de l’UI actuelle

### Conserver

- La structure sidebar / conversation / compositeur et son comportement à 840 px.
- Le regroupement des threads par espace de travail, la recherche et l’archivage.
- Le fil typé : messages, signaux, outils, historique paginé et streaming.
- Les dialogues d’approbation et de question avec gestion du focus.
- Le menu de thread et ses actions stables.
- La séparation Electron/IPC / transport JSON-RPC / normalisation / présentation.

### Restructurer avant d’étendre

- L’ancien `SettingsDialog` devient une vue dédiée catégorisée ; son formulaire est réparti
  entre « Agent et modèles » et « Permissions ».
- `ChatFooter` devient la composition de `Composer` et d’une barre de session ;
  quotas globaux et contexte du thread ne doivent plus partager le même bloc.
- Les détails de diff, navigateur et ressources utilisent un panneau contextuel dès
  que leur persistance dépasse les cartes inline ; un terminal persistant reste une
  surface inférieure séparée.
- Le menu de commandes `/` devient une palette pilotée par des commandes déclarées,
  testables et activées selon les capacités.
- `styles.css` (près de 1 000 lignes) doit être découpé par surface lors de la
  restructuration correspondante, sans extraction CSS purement mécanique.
- `App.tsx` doit céder la connexion/session et les états de surfaces avant d’ajouter
  le chargement des intégrations et du compte.
- Les composants encore minifiés (`SignalCards`, `AgentStatus`, `Markdown`) doivent
  être remis en forme lorsqu’ils gagnent leur prochaine responsabilité.

### Supprimer ou remplacer

- Le bouton « Mentionner un fichier » qui appelait le simple sélecteur de pièce
  jointe est retiré ; il reviendra avec la vraie recherche floue avant d’être
  présenté comme une mention.
- Le mini-affichage de quotas caché arbitrairement sous 850 px sera remplacé par un
  résumé de compte accessible dans les réglages ; seule l’alerte utile restera dans
  la barre de session.
- Les entrées slash codées directement dans le JSX seront remplacées par le registre
  de commandes ; aucune commande non disponible ne doit être annoncée.
- Les futurs appels FS/process/MCP bruts ne recevront pas de boutons génériques dans
  le seul but d’augmenter la couverture protocolaire.

## Ordre de migration

1. Reprendre les conventions validées dans l’app officielle : réglages en vue dédiée,
   cartes de travail inline et panneau latéral contextuel générique.
2. Construire le centre de réglages et séparer portée globale / portée thread.
3. Introduire le panneau contextuel sans dupliquer les données du fil.
4. Remplacer le menu slash et la fausse mention par leurs architectures cibles.
5. Décomposer connexion/session dans `App.tsx`.
6. Brancher ensuite les domaines fonctionnels par fréquence d’usage.
