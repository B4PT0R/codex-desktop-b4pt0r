import {
  invoke,
  isDesktopApp,
  listen,
  type UnlistenFn,
} from "./nativeBridge";
import { JsonRpcClient } from "./jsonRpc";
import { defaultTranslate, type Translate } from "../i18n/translate";

export type AppServerMessage = {
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string };
};

type MessageHandler = (message: AppServerMessage) => void;
type ConnectionHandler = (connected: boolean, error?: Error) => void;
type AppServerExit = { code: number | null; message: string | null };

const messageHandlers = new Set<MessageHandler>();
const connectionHandlers = new Set<ConnectionHandler>();
let translate = defaultTranslate;
const rpc = new JsonRpcClient(
  (message) => invoke("send_app_server", { message }),
  (key, params) => translate(key, params),
);

let initialized = false;
let listenersPromise: Promise<void> | undefined;
let connectionPromise: Promise<void> | undefined;
let unlistenMessage: UnlistenFn | undefined;
let unlistenExit: UnlistenFn | undefined;
let lastProtocolWarningAt = Number.NEGATIVE_INFINITY;
const PROTOCOL_WARNING_INTERVAL_MS = 30_000;

export function configureCodexTranslation(nextTranslate: Translate) {
  translate = nextTranslate;
}

export { isDesktopApp };

export async function connect(
  messageHandler: MessageHandler,
  connectionHandler?: ConnectionHandler,
) {
  messageHandlers.add(messageHandler);
  if (connectionHandler) connectionHandlers.add(connectionHandler);
  if (!isDesktopApp()) {
    return () => removeHandlers(messageHandler, connectionHandler);
  }

  try {
    await ensureConnected();
    connectionHandler?.(true);
  } catch (cause) {
    const error = asError(cause, translate("transport.connectError"));
    connectionHandler?.(false, error);
    removeHandlers(messageHandler, connectionHandler);
    throw error;
  }
  return () => removeHandlers(messageHandler, connectionHandler);
}

export function subscribeAppServerMessages(messageHandler: MessageHandler) {
  messageHandlers.add(messageHandler);
  return () => {
    messageHandlers.delete(messageHandler);
  };
}

export function request<T = unknown>(
  method: string,
  params?: unknown,
): Promise<T> {
  if (!isDesktopApp())
    return Promise.reject(new Error(translate("transport.browserPreview")));
  return rpc.request<T>(method, params);
}

export async function notify(method: string, params?: unknown) {
  if (!isDesktopApp()) return;
  await invoke("send_app_server", {
    message: JSON.stringify({
      method,
      ...(params === undefined ? {} : { params }),
    }),
  });
}

export async function respond(id: number | string, result: unknown) {
  if (!isDesktopApp()) return;
  await invoke("send_app_server", { message: JSON.stringify({ id, result }) });
}

export async function reconnect() {
  if (!isDesktopApp()) return;
  try {
    await ensureConnected();
  } catch (cause) {
    const error = asError(cause, translate("transport.reconnectError"));
    notifyConnection(false, error);
    throw error;
  }
}

export async function restartAppServer() {
  if (!isDesktopApp()) return;
  initialized = false;
  rpc.disconnect(new Error(translate("transport.restarting")));
  notifyConnection(false);
  try {
    await invoke("restart_app_server");
    await ensureConnected();
  } catch (cause) {
    const error = asError(cause, translate("transport.restartError"));
    notifyConnection(false, error);
    throw error;
  }
}

async function ensureConnected() {
  if (initialized) return;
  if (!connectionPromise) {
    connectionPromise = initializeConnection().finally(() => {
      connectionPromise = undefined;
    });
  }
  await connectionPromise;
}

async function initializeConnection() {
  await ensureListeners();
  const needsInitialization = await invoke<boolean>("start_app_server");
  if (needsInitialization) {
    try {
      await rpc.request("initialize", {
        clientInfo: {
          name: "codex-desktop-linux",
          title: "Codex Desktop Linux",
          version: "0.3.0",
        },
        capabilities: { experimentalApi: true },
      });
    } catch (error) {
      if (!isReusableInitialization(error)) throw error;
    }
    await notify("initialized", {});
  }
  initialized = true;
  notifyConnection(true);
}

export function isReusableInitialization(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return ["Already initialized", "Error: Already initialized"].includes(
    message,
  );
}

async function ensureListeners() {
  if (!listenersPromise) {
    listenersPromise = Promise.all([
      listen<string>("app-server-message", ({ payload }) =>
        receiveMessage(payload),
      ),
      listen<AppServerExit>("app-server-exited", ({ payload }) =>
        handleExit(payload),
      ),
    ]).then(([messageListener, exitListener]) => {
      unlistenMessage = messageListener;
      unlistenExit = exitListener;
    });
  }
  await listenersPromise;
}

function receiveMessage(payload: string) {
  try {
    const message = parseAppServerPayload(payload);
    if (rpc.receive(message)) return;
    if (isAppServerMessage(message)) {
      for (const handler of messageHandlers) handler(message);
    }
  } catch {
    const now = Date.now();
    if (now - lastProtocolWarningAt < PROTOCOL_WARNING_INTERVAL_MS) return;
    lastProtocolWarningAt = now;
    for (const handler of messageHandlers)
      handler({ method: "client/protocol/error" });
  }
}

export function parseAppServerPayload(payload: string): object {
  const message: unknown = JSON.parse(payload);
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    throw new Error("Invalid App Server message envelope");
  }
  return message;
}

function handleExit(exit: AppServerExit) {
  initialized = false;
  const detail =
    exit.message ??
    (exit.code == null
      ? translate("transport.exitNoCode")
      : translate("transport.exitCode", { code: exit.code }));
  const error = new Error(translate("transport.exit", { detail }));
  rpc.disconnect(error);
  notifyConnection(false, error);
}

function notifyConnection(connected: boolean, error?: Error) {
  for (const handler of connectionHandlers) handler(connected, error);
}

function removeHandlers(
  messageHandler: MessageHandler,
  connectionHandler?: ConnectionHandler,
) {
  messageHandlers.delete(messageHandler);
  if (connectionHandler) connectionHandlers.delete(connectionHandler);
}

function isAppServerMessage(message: unknown): message is AppServerMessage {
  return !!message && typeof message === "object";
}

function asError(cause: unknown, fallback: string): Error {
  return cause instanceof Error
    ? cause
    : new Error(typeof cause === "string" ? cause : fallback);
}

// Keep the listener handles alive for the application lifetime.
void unlistenMessage;
void unlistenExit;
