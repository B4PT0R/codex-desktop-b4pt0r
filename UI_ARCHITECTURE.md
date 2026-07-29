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

Les workspaces forment un accordéon compact : le groupe du thread actif
s’ouvre automatiquement, un seul groupe reste déplié lors de la navigation
ordinaire, et tous les groupes contenant des résultats s’ouvrent pendant une
recherche. Le repli reste une préférence de présentation locale et ne modifie
aucun état App Server.

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

Une vague d’outils conserve un en-tête de groupe stable dès le premier appel.
Chaque action n’a que trois états visuels : ouverte, repliée sur le même en-tête
monoligne, ou masquée dans l’historique du groupe. La fermeture anime uniquement
le panneau de détail ; l’appel suivant attend la fin de cette animation. Quand
la limite globale réglée dans Chat serait dépassée, l’action visible la plus
ancienne disparaît avant l’arrivée de la suivante. Des steps agentiques
silencieux restent agrégés ; un item non-action ou du nouveau texte crée une
frontière. Le groupe entier ne se replie qu’une fois toutes ses actions résolues
et cette frontière atteinte, ou le tour terminé.
Un `agentMessage` vide ne constitue jamais une frontière : ces placeholders
sont éliminés au live et au replay avant l’agrégation de l’appel suivant.
Il en va de même pour un item de raisonnement sans résumé ; si un résumé
apparaît plus tard, son premier delta visible crée alors la frontière.
Une commande identifiée par `thread/backgroundTerminals/list` constitue
l’exception : son processus reste réellement actif et continue d’alimenter ses
détails, mais sa carte se replie après un court délai et ne retient pas les
appels suivants. Son statut reste « en arrière-plan » jusqu’à sa terminaison.

### 4. Compositeur et barre de session

Responsabilités :

- texte, images/fichiers, mentions et audio ;
- commandes shell locales préfixées par `!`, toujours confirmées car exécutées sans
  sandbox sur l’hôte App Server ;
- envoyer, diriger un tour actif et interrompre ;
- accès rapide au modèle, mode de travail, profil de permissions et politique
  d’approbation ; ces deux derniers réglages restent distincts et reflètent
  l’état effectif renvoyé par App Server ;
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
- une image générée quitte l’accordéon technique dès qu’elle est disponible :
  son widget média reste ouvert dans le fil jusqu’à un repli explicite et
  propose un overlay plein écran ainsi qu’un enregistrement local borné ;
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

Le centre utilise une frontière de portée stricte : toutes ses sections
configurent exclusivement des préférences persistantes globales. Le modèle,
l’effort et le mode Plan du thread restent dans le popover Modèle ; permissions
et approbations partagent le popover Security sous le composer.

Le centre utilise une navigation interne durable :

1. **Général** — langue, démarrage, ouverture des fichiers et cycle App Server ;
2. **Web** — recherche web globale, Chromium Playwright partagé, activation, état et réparation ;
3. **Chat** — résumés et futures préférences globales qui contrôlent le niveau de détail visible ;
4. **Agent** — modèle, effort, personnalité et comportement globaux ;
5. **Permissions par défaut** — profils, approbations et exigences administrées ;
6. **Configuration** — champs TOML globaux guidés, éditeur brut et instructions personnelles ;
7. **Intégrations** — MCP, apps/connecteurs, plugins, skills et hooks ;
8. **Tâches planifiées** — réveils locaux, cible de conversation, pause et exécution immédiate ;
9. **Compte et utilisation** — connexion, quotas, consommation et messages ;
10. **Avancé** — fonctions expérimentales, import d’autres agents, contrôle distant,
    diagnostics et feedback.

État actuel : les inventaires stables `skills/list`, `mcpServerStatus/list` et
`hooks/list` sont branchés, ainsi que l’activation des skills et la connexion OAuth
MCP complète. Les hooks effectifs du projet restent volontairement en lecture seule :
leur origine, confiance et commande sont consultables, sans simuler une API de mutation.
Les apps accessibles et activées de
`app/list` apparaissent dans les réglages et peuvent être ajoutées au compositeur
comme mentions structurées `app://`; le catalogue complet n'est pas chargé dans
la navigation quotidienne. Les skills actives peuvent être jointes depuis le
menu d’ajout : le compositeur envoie alors l’item App Server structuré
`{ type: "skill", name, path }` et le message utilisateur affiche un indicateur
discret, restauré depuis le même item lors du replay. Une invocation implicite
reste volontairement sans indicateur, App Server ne publiant aucun événement
stable qui permettrait de l’attribuer avec certitude. Le catalogue et l’installation de
plugins restent isolés tant que la documentation officielle les interdit aux
clients de production.
Les surfaces propres à un plugin ne deviennent pas des catégories globales :
Git et la gestion de workspaces restent exposés par les workflows ou plugins
qui les possèdent, pas par une section native vide du centre de réglages.

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

Les réglages courants du thread ne sont jamais répétés dans les sections
globales. Le mode Plan est une section du sélecteur de modèle ; permissions et
approbations sont regroupées dans Security ; la personnalité reste un défaut
global dans Agent.

Les tâches planifiées sont une capacité native du client, pas une API App
Server inventée. Electron persiste et réclame les échéances récurrentes ou
datées une seule fois, puis le contrôleur renderer démarre ou reprend un thread
et lance un tour ordinaire. La cible peut être le thread existant choisi, un
nouveau thread persistant visible dans la navigation, ou un nouveau thread
éphémère adapté aux tâches dont seul l’effet compte. Une échéance unique se
désactive atomiquement dès sa réclamation pour ne jamais être rejouée après un
redémarrage.

Un coordinateur commun réserve les opérations qui produisent un tour. Un réveil
ciblant un thread actif attend sa prochaine frontière inactive ; plusieurs
réveils du même thread restent ordonnés, tandis que des threads différents
travaillent en parallèle. Le prompt planifié porte une enveloppe stable
`Codex Desktop Scheduler` : le modèle comprend qu’il ne s’agit pas d’un
steering utilisateur et le fil la restitue, y compris au replay, dans une carte
de réveil identifiable.

Par défaut, la tâche conserve les permissions et approbations ordinaires. Le
formulaire propose séparément une exécution sans surveillance, volontairement
alarmante : Full access et Never ask ne sont alors appliqués qu’au réveil, puis
les réglages effectifs capturés avant le tour sont restaurés avant de libérer la
file du thread. Cet opt-in dangereux ne doit jamais devenir le défaut.

Les nouveaux threads textuels déclarent en outre un namespace App Server
`scheduler` via `dynamicTools`. L’agent peut ainsi utiliser le même contrôleur
borné pour lister, créer, modifier, activer, désactiver ou lancer une tâche sans
plugin ni accès arbitraire aux réglages natifs. La suppression suspend la
réponse `item/tool/call` jusqu’à confirmation dans un dialogue destructif. App
Server restaure les définitions avec le rollout au `thread/resume`; la version
0.145 ne permet pas de les greffer rétroactivement aux anciens threads. Les
forks Realtime et les threads d’exécution planifiée n’enregistrent pas ces
outils, afin de garder leurs responsabilités fermées.

Les événements de ce travail restent routés par `threadId` : ils mettent à jour
la navigation sans polluer la conversation consultée. La fermeture de la fenêtre
conserve le renderer et App Server en tâche de fond ; quitter réellement
l’application interrompt les exécutions, qui sont marquées en échec au
redémarrage. Cette frontière permet d’adopter ultérieurement le daemon Unix
expérimental sans changer le modèle produit.

Les icônes circulaires statiques et interactives utilisent la primitive commune
`RoundIcon`/`RoundIconButton`. Ses variantes `primary`, `secondary` et
`tertiary` définissent le niveau d’accent, de fond et de bordure ; les features
ne surchargent que les couleurs sémantiques. Les tailles `small`, `medium` et
`large` ainsi que le label texte optionnel appartiennent aussi à la primitive ;
les composants ne recréent pas leur propre géométrie d’icône.

La connexion ChatGPT gérée par Codex ouvre le navigateur système, conserve le
`loginId` pour permettre réouverture et annulation, et attend la notification de
fin avant de relire le compte. La déconnexion d’une identité gérée est confirmée ;
les identifiants Bedrock externes restent administrés hors de l’application.

## Carte des capacités

| Domaine App Server                | Surface principale                               | Traitement UI                                                   |
| --------------------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| Threads et tours                  | Navigation, en-tête, conversation                | Produit principal                                               |
| Modèles et collaboration          | Barre de session, réglages                       | Contrôles fréquents + détail                                    |
| Permissions et approbations       | Barre de session, réglages, dialogue             | Choix explicites et sûrs                                        |
| Outils, commandes et fichiers     | Conversation, panneau contextuel                 | Résumé inline, détail persistant                                |
| Revue                             | Carte de changement, panneau contextuel          | Flux guidé, pas un réglage                                      |
| MCP, apps, plugins, skills, hooks | Réglages Intégrations, mentions                  | Catalogue et état de connexion                                  |
| Compte, quotas, usage, messages   | Réglages Compte, indicateurs discrets            | Global, jamais mélangé au contexte                              |
| Realtime                          | Compositeur et conversation                      | Action directe, parole streamée dans le message vocal principal |
| Configuration                     | Réglages globaux par domaine, éditeur TOML borné | Guidage courant + échappatoire avancée                          |
| Expérimental et import            | Réglages Avancé                                  | Isolé et clairement signalé                                     |
| FS, process, exec, ressources MCP | Infrastructure/panneaux                          | Pas de console RPC générique                                    |
| Warnings, diagnostics, feedback   | Conversation ou Avancé selon portée              | Actionnable, dédupliqué                                         |

Les workflows navigateur ne chargent pas une seconde WebView générale dans le
shell Electron. L’application embarque des versions épinglées de
`playwright-core` et de Playwright MCP, mais télécharge leur Chromium compatible
uniquement après activation explicite. Le navigateur, son profil persistant,
les sorties MCP et les artefacts servis localement appartiennent aux données
utilisateur de Codex Desktop sous `~/.local/share/codex-desktop/`.
L’activation, les versions installées, l’état de partage et la réparation sont
regroupés dans la section autonome **Web** plutôt que dans les
préférences générales.
La désactivation arrête le serveur local et retire l’entrée MCP `playwright`
uniquement si elle correspond encore à celle que l’application possède ; une
configuration Playwright personnalisée créée ensuite par l’utilisateur est
préservée.

La couche native possède le serveur Playwright MCP HTTP lié au loopback. L’UI
est un client minimal de ce serveur pour ouvrir les liens ; App Server reçoit
automatiquement la même URL via la commande officielle `codex mcp`, puis recharge
sa configuration. `--shared-browser-context` garantit que l’utilisateur et
l’agent manipulent les mêmes onglets visibles. Aucune installation Chromium
système, détection Snap/Flatpak ou élévation de privilèges n’appartient au chemin
normal. Lorsque la fonction est inactive, incomplète ou indisponible, les URL
HTTP(S) sont confiées au navigateur par défaut du système.
La session MCP interne utilisée par l’UI est indépendante de celle d’App Server.
Elle conserve son canal d’événements HTTP ouvert afin que Playwright maintienne
le contexte partagé même sans tour agent actif. Le flux est attaché dès que
`initialize` fournit l’identifiant de session, avant la notification
`initialized`, puis le client répond aux heartbeats JSON-RPC reçus sur ce flux.
Si Playwright expire la session, le client natif refait une fois son handshake
et rejoue la navigation ; les autres erreurs restent visibles et suivent le
repli normal. Le serveur enfant est signalé avant la fin d’Electron. Une reprise
après fermeture anormale ne termine un PID résiduel qu’après validation de son
propriétaire, de sa commande, de son port et du profil applicatif.

Le processus App Server de ce client neutralise localement `browser_use`,
`browser_use_external`, `in_app_browser` et `computer_use`. Le Browser officiel
et son skill ne sont pas pris en charge par cette interface et ne doivent pas
être proposés en concurrence avec Playwright MCP. Ces surcharges ne sont pas
écrites dans `config.toml` et n’affectent donc ni la CLI ni les autres clients.

L’application embarque en complément la skill `use-shared-browser` comme
ressource externe à l’archive ASAR. À chaque nouveau processus App Server, le
renderer enregistre ce répertoire en lecture seule avec
`skills/extraRoots/set`. La skill reste ainsi propre à ce client : elle n’est
copiée ni dans `~/.codex/skills`, ni dans le workspace, et ne modifie pas le
comportement de la CLI. Sa dépendance MCP `playwright` et ses instructions
orientent les demandes de navigation vers la fenêtre partagée, expliquent
l’indisponibilité des surfaces Browser de l’application officielle et
interdisent d’installer une pile de navigation concurrente.

Les liens du transcript passent par un routeur explicite plutôt que par la
navigation de la WebView Electron. Les URL HTTP(S) ouvrent la session Playwright partagée,
avec le navigateur système comme repli. Les références de fichiers sont
résolues et canonicalisées par Electron : un chemin relatif part du workspace,
alors qu’un chemin absolu peut viser un checkout voisin, la configuration Codex
ou un artefact temporaire. Un fichier est ouvert par le schéma d’éditeur
configuré sans commande shell lorsqu’il contient du texte UTF-8. Les fichiers
non-UTF-8 ou binaires utilisent l’application système par défaut, et un dossier
est délégué à l’explorateur de fichiers du système. Les protocoles inconnus et
les chemins absents sont refusés avec une erreur visible dans la conversation.

L’objectif autonome et `AGENTS.md` sont des actions de configuration contextuelle
du thread ou du workspace. Elles sont regroupées dans le menu ouvert par le titre
de la conversation afin de garder la barre supérieure calme, tout en restant
accessibles au même endroit que les autres actions du thread. `AGENTS.md` ouvre
un grand éditeur modal adapté aux instructions longues. La couche native ne
fournit pas un accès générique aux fichiers : elle borne lecture et écriture au
seul `<workspace>/AGENTS.md`, détecte les conflits externes, refuse les liens
symboliques et remplace le fichier atomiquement.

Le `AGENTS.md` personnel appartient en revanche à la section **Config**, à côté
de `config.toml`, car sa portée est globale à Codex plutôt que liée au workspace
courant. Son éditeur suit les mêmes garanties natives sur le seul chemin
`$CODEX_HOME/AGENTS.md` et signale explicitement un `AGENTS.override.md` global
non vide, qui prend priorité selon les règles de découverte Codex.
La page garde ces deux documents sous forme de cartes compactes et ouvre leur
éditeur partagé dans une modale : le contenu long ne monopolise ainsi pas la
navigation Config, tandis que focus, raccourci d’enregistrement et protection
des brouillons suivent le même contrat pour les deux fichiers.

Le **Contrôle à distance** possède une section personnelle distincte, placée à
côté de Memory plutôt que dans Config ou Permissions. Elle reflète l’état
autoritaire d’App Server : activation persistante du relais, connexion,
association par code temporaire, liste paginée des appareils et révocation
confirmée. L’interface n’émule aucun de ces états côté client et rend
explicitement les cas aperçu navigateur, politique administrée et erreur. La
désactivation interrompt le relais mais ne prétend pas supprimer les
autorisations déjà accordées.

## Audit de l’UI actuelle

### Conserver

- La structure sidebar / conversation / compositeur et son comportement à 840 px.
- Le regroupement des threads par espace de travail, la recherche et l’archivage.
- Le fil typé : messages, signaux, outils, historique paginé et streaming.
- Les erreurs produites par l’application utilisent une carte d’alerte dédiée
  avec titre et détail technique ; elles ne se font jamais passer pour une
  réponse ordinaire de l’agent.
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
  testables et activées selon les capacités. Il s’ancre au-dessus du composer
  avec un espace visible : la palette peut défiler, mais ne recouvre jamais la
  saisie en cours.
- Pendant une session Realtime, les deltas du transcript assistant alimentent
  directement le message vocal principal dans la conversation. La finalisation
  remplace l’assemblage provisoire en place ; le composer ne porte aucune
  surface de transcript redondante.
- Le hook de conversation Realtime possède le fork éphémère, filtre les
  notifications tardives, sérialise l’injection des transcriptions dans le
  parent et centralise tous les chemins d’arrêt. `App.tsx` ne coordonne que le
  déclenchement depuis le compositeur.
- Les rafales de notifications qui modifient le fil sont réduites dans l’ordre
  à une mise à jour React non urgente par fenêtre de 16 ms. Les interactions
  du compositeur, la dictée et les demandes bloquantes gardent ainsi la
  priorité, et un changement de thread invalide la file en attente.
- Les réponses finalisées de l’agent vocal restent le flux principal du chat et
  portent l’accent rose Realtime. Les messages produits en parallèle par
  l’agent textuel utilisent une surface bleue secondaire : visible pendant le
  streaming, elle se replie automatiquement tout en restant réouvrable. Les
  actions techniques conservent leur présentation autonome.
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
