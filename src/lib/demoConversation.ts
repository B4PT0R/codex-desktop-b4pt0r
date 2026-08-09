import type {
  AppInfo,
  AppServerSkill,
  RateLimitResetCreditsSummary,
} from "./appServerTypes";
import type {
  ChatMessage,
  Quota,
  SubagentTranscript,
  ThreadSummary,
} from "../types";
import type { ThreadTelemetry } from "./sessionTelemetry";
import type { Translate } from "../i18n/translate";

const demoGeneratedImageUrl = new URL(
  "../assets/generated-image-widget-source.jpg",
  import.meta.url,
).href;

export function demoConversation(): ChatMessage[] {
  return [
    {
      id: "demo-user-1",
      role: "user",
      content:
        "Peux-tu examiner le shell Electron, retirer la barre de menu native et rendre le défilement du chat plus discret ?",
    },
    {
      id: "demo-assistant-1",
      role: "assistant",
      content:
        "Je vais inspecter la fenêtre et le fil de conversation, puis appliquer un correctif ciblé avec ses tests.",
      signals: [
        {
          id: "demo-plan",
          kind: "plan",
          title: "Plan",
          steps: [
            { step: "Inspecter le shell et le layout", status: "completed" },
            { step: "Masquer le menu Electron", status: "completed" },
            { step: "Moderniser le scrollbar", status: "completed" },
            { step: "Valider le build natif", status: "inProgress" },
          ],
          status: "running",
        },
        {
          id: "demo-reasoning",
          kind: "reasoning",
          title: "Analyse de l’interface",
          detail:
            "Le footer occupe une ligne distincte. Un scrollbar transparent au repos évite l’impression d’une piste interrompue au-dessus du composer.",
          status: "done",
        },
      ],
      tools: [
        {
          id: "demo-search",
          kind: "webSearch",
          title: "Recherche dans le projet",
          detail: 'rg "BrowserWindow|scrollbar|conversation" electron src',
          status: "done",
          durationMs: 84,
        },
        {
          id: "demo-tests",
          kind: "commandExecution",
          title: "Tests Electron",
          detail: "npm run test:electron",
          status: "done",
          output: "18 tests réussis",
          exitCode: 0,
          durationMs: 103,
        },
        {
          id: "demo-subagent",
          kind: "collabAgentToolCall",
          title: "Audit délégué",
          detail: "Vérifier la frontière IPC Electron",
          status: "done",
          subagent: {
            threadIds: ["demo-child-thread"],
            prompt: "Vérifie la sécurité et les tests de la frontière IPC.",
            model: "gpt-5.4",
            reasoningEffort: "high",
            status: "completed",
          },
        },
        {
          id: "demo-files",
          kind: "fileChange",
          title: "Modification de fichiers",
          detail: "electron/window.mjs, src/styles.css",
          status: "done",
          diff: `diff --git a/electron/window.mjs b/electron/window.mjs
index d49c4b1..7533f2a 100644
--- a/electron/window.mjs
+++ b/electron/window.mjs
@@ -42,6 +42,7 @@ export function createMainWindow() {
     show: false,
     webPreferences: secureWebPreferences,
   });
+  window.setMenu(null);
   window.once("ready-to-show", () => window.show());
 }
diff --git a/src/styles.css b/src/styles.css
index 08a1e34..66d19a2 100644
--- a/src/styles.css
+++ b/src/styles.css
@@ -118,7 +118,11 @@
 .conversation {
   overflow-y: auto;
-  scrollbar-color: #5a5a5680 transparent;
+  scrollbar-color: transparent transparent;
+}
+
+.conversation:hover {
+  scrollbar-color: #5a5a5680 transparent;
 }`,
        },
      ],
    },
    {
      id: "demo-user-2",
      role: "user",
      content:
        "Ça paraît mieux. Vérifie aussi que la vue reste propre à la taille minimale.",
    },
    {
      id: "demo-assistant-2",
      role: "assistant",
      modality: "realtimeText",
      content:
        "La mise en page reste stable à **840 × 620**. Le curseur disparaît au repos et réapparaît au survol ou au focus clavier.\n\nLe paquet Debian a été reconstruit : la barre de menu native a disparu tandis que le menu du tray reste disponible.\n\nLe renderer scientifique prend aussi en charge l’énergie $E = mc^2$ et des blocs LaTeX élaborés.\n\nUn développement aligné :\n\n\\[\n\\begin{aligned}\n(a+b)^2 &= (a+b)(a+b) \\\\\n        &= a^2 + 2ab + b^2, \\\\\n\\frac{d}{dx}\\,e^{x^2} &= 2x e^{x^2}.\n\\end{aligned}\n\\]\n\nUne opération matricielle :\n\n\\[\n\\begin{bmatrix}\n1 & 2 \\\\\n3 & 4\n\\end{bmatrix}\n\\begin{pmatrix}\nx \\\\\ny\n\\end{pmatrix}\n=\n\\begin{pmatrix}\nx + 2y \\\\\n3x + 4y\n\\end{pmatrix}\n\\]\n\nEt une définition par morceaux :\n\n\\[\nf(x)=\n\\begin{cases}\nx^2, & x \\ge 0, \\\\\n-x,  & x < 0.\n\\end{cases}\n\\]",
      signals: [
        {
          id: "demo-compaction",
          kind: "compaction",
          title: "Contexte compacté",
          status: "done",
        },
      ],
      tools: [
        {
          id: "demo-check",
          kind: "commandExecution",
          title: "Vérification TypeScript",
          detail: "npm run check",
          status: "done",
          exitCode: 0,
          durationMs: 2_714,
        },
        {
          id: "demo-build",
          kind: "commandExecution",
          title: "Build de production",
          detail: "npm run build",
          status: "done",
          exitCode: 0,
          durationMs: 4_982,
        },
        {
          id: "demo-generated-image",
          kind: "imageGeneration",
          title: "Génération d’image",
          detail: "Un chat astronaute",
          status: "done",
          artifacts: [
            {
              type: "generatedImage",
              dataUrl: demoGeneratedImageUrl,
              prompt: "Un chat astronaute flottant dans l’espace",
            },
          ],
        },
      ],
    },
    {
      id: "demo-realtime-voice",
      role: "assistant",
      modality: "realtimeVoice",
      content:
        "Oui, la vue reste propre à la taille minimale. Les vérifications TypeScript et le build de production sont terminés.",
    },
  ];
}

export const demoSubagentTranscripts: Record<string, SubagentTranscript> = {
  "demo-child-thread": {
    name: "Atlas",
    role: "reviewer",
    status: "completed",
    messages: [
      {
        id: "demo-child-intro",
        role: "assistant",
        content:
          "Je contrôle les canaux exposés par le preload et leurs validations.",
        tools: [
          {
            id: "demo-child-search",
            kind: "webSearch",
            title: "Inspection IPC",
            detail: 'rg "ipcMain.handle|contextBridge" electron',
            status: "done",
            durationMs: 71,
          },
          {
            id: "demo-child-tests",
            kind: "commandExecution",
            title: "Tests Electron ciblés",
            detail: "node --test electron/window.test.mjs",
            status: "done",
            output: "12 tests réussis",
            exitCode: 0,
            durationMs: 486,
          },
        ],
      },
      {
        id: "demo-child-result",
        role: "assistant",
        content:
          "La surface preload reste bornée et les entrées natives sont validées avant exécution.",
      },
    ],
  },
};

export function readmeDemoConversation(): ChatMessage[] {
  return [
    {
      id: "readme-user-1",
      role: "user",
      content:
        "Review the workspace navigation and make long Codex sessions easier to scan.",
    },
    {
      id: "readme-assistant-1",
      role: "assistant",
      content:
        "I’ll inspect the conversation hierarchy, tighten technical activity, and validate the result at the supported window sizes.",
      signals: [
        {
          id: "readme-plan",
          kind: "plan",
          title: "Plan",
          steps: [
            { step: "Review the conversation layout", status: "completed" },
            { step: "Group threads by workspace", status: "completed" },
            { step: "Polish light and dark themes", status: "completed" },
            { step: "Validate the packaged client", status: "inProgress" },
          ],
          status: "running",
        },
        {
          id: "readme-reasoning",
          kind: "reasoning",
          title: "Interface analysis",
          detail:
            "The main conversation should stay calm while tools, plans, and session controls remain available through progressive disclosure.",
          status: "done",
        },
      ],
      tools: [
        {
          id: "readme-search",
          kind: "webSearch",
          title: "Inspect workspace navigation",
          detail: 'rg "Sidebar|conversation|workspace" src tests',
          status: "done",
          durationMs: 92,
        },
        {
          id: "readme-tests",
          kind: "commandExecution",
          title: "Run interface tests",
          detail: "npm test",
          status: "done",
          output: "494 tests passed",
          exitCode: 0,
          durationMs: 3_184,
        },
        {
          id: "readme-files",
          kind: "fileChange",
          title: "Update navigation and theme",
          detail: "Sidebar.tsx, appearance.css, rendering tests",
          status: "done",
          diff: `diff --git a/src/components/Sidebar.tsx b/src/components/Sidebar.tsx
index 32c0da5..a7c85d0 100644
--- a/src/components/Sidebar.tsx
+++ b/src/components/Sidebar.tsx
@@ -153,6 +153,8 @@ export function Sidebar() {
+  <SidebarThreadGroup
+    expanded={selectedWorkspace === workspace}
+  />`,
        },
      ],
    },
    {
      id: "readme-user-2",
      role: "user",
      content:
        "That feels much clearer. Keep compaction subtle and confirm the compact layout.",
    },
    {
      id: "readme-text-agent",
      role: "assistant",
      modality: "realtimeText",
      content:
        "The layout remains stable at **840 × 620**. Workspace groups stay accessible, the latest thread opens automatically, and primary text now uses a softer reader-friendly ink.",
      signals: [
        {
          id: "readme-compaction",
          kind: "compaction",
          title: "Context compacted",
          status: "done",
        },
      ],
    },
    {
      id: "readme-voice-agent",
      role: "assistant",
      modality: "realtimeVoice",
      content:
        "The packaged Electron client is ready. TypeScript, App Server contracts, and native tests all pass.",
    },
  ];
}

export function initialPreviewMessages() {
  return isReadmeDemoPreview()
    ? readmeDemoConversation()
    : isDemoPreview()
      ? demoConversation()
      : [];
}

export function browserPreviewResponse(t: Translate): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: t("app.preview"),
    tools: [
      {
        id: "1",
        kind: "commandExecution",
        title: t("app.previewTool"),
        detail: "rg --files src",
        status: "done",
        output: "src/App.tsx\nsrc/components/Conversation.tsx\n",
        exitCode: 0,
        durationMs: 84,
      },
      {
        id: "2",
        kind: "imageGeneration",
        title: t("tool.imageGeneration"),
        detail: t("app.previewImage"),
        status: "done",
        artifacts: [
          {
            type: "generatedImage",
            dataUrl:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAJEAIAAADk2OcmAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGYktHRP///////wlY99wAAAAHdElNRQfqBxMMIg+1kBTwAAAAYElEQVQoz2MMC8vObmtjoBlg+Vn1Y8fXMhpa8Kvy+45vpbT1wXYa++AHTX3AaLrNiSnwEk19gCUO/kMsx6HnP7IDCemCxcF/JI2MeAxHNgybeog4kgijkpKmppER7YIIAA8zKkZIs1QvAAAAAElFTkSuQmCC",
            prompt: t("app.previewImage"),
          },
        ],
      },
      {
        id: "3",
        kind: "webSearch",
        title: t("tool.web"),
        detail: t("app.previewSearch"),
        status: "done",
        artifacts: [
          {
            type: "webResult",
            title: t("app.previewResult"),
            url: "https://developers.openai.com/codex/",
            snippet: t("app.previewSnippet"),
          },
        ],
      },
    ],
  };
}

export function isDemoPreview() {
  return (
    (window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost") &&
    new URLSearchParams(window.location.search).has("demo")
  );
}

export function isReadmeDemoPreview() {
  return (
    isDemoPreview() &&
    new URLSearchParams(window.location.search).get("demo") === "readme"
  );
}

export function isUpdateDemoPreview() {
  return (
    isDemoPreview() &&
    new URLSearchParams(window.location.search).get("update") === "available"
  );
}

export const demoSkills: AppServerSkill[] = [
  {
    name: "use-shared-browser",
    shortDescription: "Use the visible shared Playwright browser",
    description:
      "Open and interact with pages in the browser shared with the user.",
    path: "/opt/Codex Desktop/resources/skills/use-shared-browser/SKILL.md",
    scope: "system",
    enabled: true,
  },
  {
    name: "skill-creator",
    shortDescription: "Create or update a Codex skill",
    description: "Guide the creation of focused reusable agent instructions.",
    path: "/preview/skills/skill-creator/SKILL.md",
    scope: "system",
    enabled: true,
  },
];

export const demoApps: AppInfo[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Search repositories, issues, and pull requests.",
    logoUrl: null,
    logoUrlDark: null,
    distributionChannel: "hosted",
    branding: { category: "Developer tools", developer: "GitHub", website: "https://github.com", isDiscoverableApp: true },
    appMetadata: { categories: ["Developer tools"], seoDescription: null, developer: "GitHub", version: "1.0" },
    installUrl: "https://chatgpt.com/apps/github",
    isAccessible: true,
    isEnabled: true,
    pluginDisplayNames: ["GitHub"],
  },
  {
    id: "google_drive",
    name: "Google Drive",
    description: "Find and read documents from connected drives.",
    logoUrl: null,
    logoUrlDark: null,
    distributionChannel: "hosted",
    branding: { category: "Productivity", developer: "Google", website: "https://drive.google.com", isDiscoverableApp: true },
    appMetadata: { categories: ["Productivity"], seoDescription: null, developer: "Google", version: "1.0" },
    installUrl: "https://chatgpt.com/apps/google-drive",
    isAccessible: false,
    isEnabled: false,
    pluginDisplayNames: ["Google Drive"],
  },
];

export const demoTelemetry: ThreadTelemetry = {
  context: {
    usedTokens: 52_800,
    windowTokens: 128_000,
    percentUsed: 41,
    totalTokens: 68_420,
    lastOutputTokens: 1_284,
  },
};

export const demoQuotas: Quota[] = [
  {
    used: 34,
    durationMinutes: 300,
    resetsAt: Math.floor(Date.now() / 1000) + 3 * 60 * 60,
  },
  {
    used: 14,
    durationMinutes: 10_080,
    resetsAt: Math.floor(Date.now() / 1000) + 4 * 24 * 60 * 60,
  },
];

export const demoResetCredits: RateLimitResetCreditsSummary = {
  availableCount: 1,
  credits: [
    {
      id: "demo-reset-credit",
      resetType: "codexRateLimits",
      status: "available",
      grantedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
      title: null,
      description: null,
    },
  ],
};

export const demoThreads: ThreadSummary[] = [
  {
    id: "demo-current",
    name: "Polir l’interface Electron",
    cwd: "/home/baptiste/dev/codex-desktop-b4pt0r",
    status: "active",
  },
  {
    id: "demo-audio",
    isPinned: true,
    name: "Stabiliser Realtime v3",
    cwd: "/home/baptiste/dev/codex-desktop-b4pt0r",
  },
  {
    id: "demo-package",
    name: "Préparer le paquet Debian",
    cwd: "/home/baptiste/dev/codex-desktop-b4pt0r",
  },
  {
    id: "demo-auth",
    name: "Documenter les endpoints OAuth audio",
    cwd: "/home/baptiste/dev/codex-backend-sdk",
  },
  {
    id: "demo-transcription",
    name: "Mettre à jour les tests de transcription",
    cwd: "/home/baptiste/dev/codex-backend-sdk",
  },
  {
    id: "demo-changelog",
    name: "Analyser les nouveautés du dernier changelog",
    cwd: "/home/baptiste/dev/codex",
  },
  {
    id: "demo-schema",
    name: "Comparer le schéma App Server v2",
    cwd: "/home/baptiste/dev/codex",
    status: "systemError",
  },
  {
    id: "demo-voice",
    name: "Étudier l’amorçage de la session vocale",
    cwd: "/home/baptiste/dev/codex-desktop-linux",
  },
  {
    id: "demo-browser",
    name: "Inventorier la gestion du navigateur Chromium",
    cwd: "/home/baptiste/dev/codex-desktop-linux",
  },
  {
    id: "demo-dashboard",
    name: "Construire le tableau de bord d’activité",
    cwd: "/home/baptiste/dev/agent-dashboard",
  },
  {
    id: "demo-empty",
    preview: "Ajouter un état vide accueillant pour les nouveaux espaces",
    cwd: "/home/baptiste/dev/agent-dashboard",
  },
  {
    id: "demo-docs",
    name: "Réorganiser le guide de contribution",
    cwd: "/home/baptiste/dev/documentation",
  },
  {
    id: "demo-search",
    name: "Améliorer la recherche plein texte multilingue",
    cwd: "/home/baptiste/dev/documentation",
  },
  {
    id: "demo-long",
    name: "Corriger un titre volontairement très long pour vérifier la troncature élégante",
    cwd: "/home/baptiste/dev/experimental-workbench-with-a-long-name",
  },
  {
    id: "demo-untitled",
    cwd: "/home/baptiste/dev/experimental-workbench-with-a-long-name",
  },
];

export const readmeDemoThreads: ThreadSummary[] = [
  {
    id: "demo-current",
    name: "Polish the Electron interface",
    cwd: "/home/developer/projects/codex-desktop-linux",
    status: "active",
  },
  {
    id: "readme-discussion",
    kind: "discussion",
    name: "Plan the week",
    cwd: "/home/developer/Documents/Codex/2026-08-09-plan-the-week",
  },
  {
    id: "readme-realtime",
    isPinned: true,
    name: "Stabilize Realtime voice",
    cwd: "/home/developer/projects/codex-desktop-linux",
  },
  {
    id: "readme-package",
    name: "Prepare the Debian release",
    cwd: "/home/developer/projects/codex-desktop-linux",
  },
  {
    id: "readme-schema",
    name: "Compare the App Server v2 schema",
    cwd: "/home/developer/projects/codex",
  },
  {
    id: "readme-changelog",
    name: "Review the latest Codex changelog",
    cwd: "/home/developer/projects/codex",
  },
  {
    id: "readme-audio",
    name: "Document OAuth audio endpoints",
    cwd: "/home/developer/projects/codex-backend-sdk",
  },
  {
    id: "readme-transcription",
    name: "Extend transcription coverage",
    cwd: "/home/developer/projects/codex-backend-sdk",
  },
  {
    id: "readme-browser",
    name: "Test the shared Chromium session",
    cwd: "/home/developer/projects/browser-workflows",
  },
  {
    id: "readme-docs",
    name: "Refresh the contributor guide",
    cwd: "/home/developer/projects/documentation",
  },
  {
    id: "readme-search",
    name: "Improve multilingual search",
    cwd: "/home/developer/projects/documentation",
  },
  {
    id: "readme-dashboard",
    name: "Build an activity dashboard",
    cwd: "/home/developer/projects/agent-dashboard",
  },
  {
    id: "readme-empty",
    preview: "Design a welcoming empty state",
    cwd: "/home/developer/projects/agent-dashboard",
  },
];

export function previewDemoThreads() {
  return isReadmeDemoPreview() ? readmeDemoThreads : demoThreads;
}
