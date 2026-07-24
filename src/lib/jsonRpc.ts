import { defaultTranslate, type Translate } from "../i18n/translate";

export type JsonRpcId = number | string;

type PendingRequest = {
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
};

type JsonRpcResponse = {
  id: JsonRpcId;
  result?: unknown;
  error?: { message?: string };
};

export class JsonRpcClient {
  private nextId = 1;
  private readonly pending = new Map<JsonRpcId, PendingRequest>();

  constructor(
    private readonly sendMessage: (message: string) => Promise<void>,
    private readonly t: Translate = defaultTranslate,
    private readonly sessionId = crypto.randomUUID(),
  ) {}

  request<T>(method: string, params?: unknown): Promise<T> {
    const id = `${this.sessionId}:${this.nextId++}`;
    const message = JSON.stringify({
      id,
      method,
      ...(params === undefined ? {} : { params }),
    });
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
      this.sendMessage(message).catch((cause: unknown) => {
        if (!this.pending.delete(id)) return;
        reject(asError(cause, this.t("transport.sendError", { method })));
      });
    });
  }

  receive(message: unknown): boolean {
    if (!isResponse(message)) return false;
    const pending = this.pending.get(message.id);
    if (!pending) return false;
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(
        new Error(message.error.message || this.t("transport.appServerError")),
      );
    } else {
      pending.resolve(message.result);
    }
    return true;
  }

  disconnect(reason: Error): void {
    const requests = [...this.pending.values()];
    this.pending.clear();
    for (const request of requests) request.reject(reason);
  }
}

function isResponse(message: unknown): message is JsonRpcResponse {
  if (!message || typeof message !== "object" || !("id" in message))
    return false;
  const id = message.id;
  return typeof id === "number" || typeof id === "string";
}

function asError(cause: unknown, fallback: string): Error {
  return cause instanceof Error
    ? cause
    : new Error(typeof cause === "string" ? cause : fallback);
}
