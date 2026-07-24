import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GetAccountResponse,
  GetAccountTokenUsageResponse,
  GetWorkspaceMessagesResponse,
  LoginAccountResponse,
} from "./appServerTypes";
import { useI18n } from "../i18n/I18nProvider";
import { isDesktopApp, request, subscribeAppServerMessages } from "./codex";
import {
  accountReadParams,
  cancelLoginParams,
  chatgptLoginParams,
} from "./protocol";
import {
  openExternalTarget,
  safeExternalHttpUrl,
  type ExternalOpenMode,
} from "./externalTarget";

export type AccountController = {
  account: GetAccountResponse | null;
  authError?: string;
  authPending: { authUrl: string; loginId: string } | null;
  authOpenMode?: ExternalOpenMode;
  cancelLogin: () => Promise<void>;
  error?: string;
  loggingOut: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  reopenLogin: () => Promise<void>;
  refresh: () => Promise<void>;
  startLogin: () => Promise<void>;
  startingLogin: boolean;
  usage: GetAccountTokenUsageResponse | null;
  workspaceMessages: GetWorkspaceMessagesResponse | null;
};

export function useAccount(enabled: boolean): AccountController {
  const { t } = useI18n();
  const [account, setAccount] = useState<GetAccountResponse | null>(null);
  const [usage, setUsage] = useState<GetAccountTokenUsageResponse | null>(null);
  const [workspaceMessages, setWorkspaceMessages] =
    useState<GetWorkspaceMessagesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [authError, setAuthError] = useState<string>();
  const [authPending, setAuthPending] = useState<{
    authUrl: string;
    loginId: string;
  } | null>(null);
  const [startingLogin, setStartingLogin] = useState(false);
  const [authOpenMode, setAuthOpenMode] = useState<ExternalOpenMode>();
  const [loggingOut, setLoggingOut] = useState(false);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    if (!isDesktopApp()) {
      setError(t("account.nativeOnly"));
      return;
    }
    setLoading(true);
    setError(undefined);
    const [accountResult, usageResult, messagesResult] =
      await Promise.allSettled([
        request<GetAccountResponse>("account/read", accountReadParams()),
        request<GetAccountTokenUsageResponse>("account/usage/read"),
        request<GetWorkspaceMessagesResponse>("account/workspaceMessages/read"),
      ]);
    if (current !== generation.current) return;
    if (accountResult.status === "fulfilled") setAccount(accountResult.value);
    if (usageResult.status === "fulfilled") setUsage(usageResult.value);
    if (messagesResult.status === "fulfilled") {
      setWorkspaceMessages({
        ...messagesResult.value,
        messages: messagesResult.value.messages
          .filter((message) => message.archivedAt === null)
          .sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0))
          .slice(0, 20),
      });
    }
    const failures = [accountResult, usageResult, messagesResult].filter(
      (result) => result.status === "rejected",
    );
    setError(failures.length > 0 ? t("account.partial") : undefined);
    setLoading(false);
  }, [t]);

  const startLogin = useCallback(async () => {
    if (!isDesktopApp()) {
      setAuthError(t("account.login.nativeOnly"));
      return;
    }
    setStartingLogin(true);
    setAuthError(undefined);
    setAuthOpenMode(undefined);
    try {
      const response = await request<LoginAccountResponse>(
        "account/login/start",
        chatgptLoginParams(),
      );
      if (response.type !== "chatgpt") {
        throw new Error(t("account.login.unexpected"));
      }
      const authUrl = safeExternalHttpUrl(response.authUrl);
      if (!authUrl) throw new Error(t("account.login.invalidUrl"));
      setAuthPending({ authUrl, loginId: response.loginId });
      setAuthOpenMode(await openExternalTarget(authUrl));
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setStartingLogin(false);
    }
  }, [t]);

  const reopenLogin = useCallback(async () => {
    if (!authPending) return;
    try {
      setAuthOpenMode(await openExternalTarget(authPending.authUrl));
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [authPending]);

  const cancelLogin = useCallback(async () => {
    if (!authPending) return;
    try {
      await request(
        "account/login/cancel",
        cancelLoginParams(authPending.loginId),
      );
      setAuthPending(null);
      setAuthOpenMode(undefined);
      setAuthError(undefined);
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [authPending]);

  const logout = useCallback(async () => {
    setLoggingOut(true);
    setAuthError(undefined);
    try {
      await request("account/logout");
      await refresh();
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoggingOut(false);
    }
  }, [refresh]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !isDesktopApp()) return;
    return subscribeAppServerMessages((message) => {
      if (message.method === "account/updated") void refresh();
      if (message.method === "account/login/completed") {
        const params = record(message.params);
        const loginId = stringValue(params?.loginId);
        if (loginId && loginId !== authPending?.loginId) return;
        setAuthPending(null);
        setAuthOpenMode(undefined);
        if (params?.success === true) {
          setAuthError(undefined);
          void refresh();
        } else {
          setAuthError(stringValue(params?.error) ?? t("account.login.failed"));
        }
      }
    });
  }, [authPending?.loginId, enabled, refresh, t]);

  return {
    account,
    authError,
    authOpenMode,
    authPending,
    cancelLogin,
    error,
    loading,
    loggingOut,
    logout,
    refresh,
    reopenLogin,
    startLogin,
    startingLogin,
    usage,
    workspaceMessages,
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
