import type { RateLimitResetCreditsSummary } from "./appServerTypes";
import type { ChatMessage, Quota, ThreadSummary } from "../types";
import type { ThreadTelemetry } from "./sessionTelemetry";

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
          title: "Plan d’implémentation",
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

export function initialPreviewMessages() {
  return isDemoPreview() ? demoConversation() : [];
}

export function isDemoPreview() {
  return (
    (window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost") &&
    new URLSearchParams(window.location.search).has("demo")
  );
}

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
