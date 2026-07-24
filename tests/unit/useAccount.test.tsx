// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
const subscribeMock = vi.hoisted(() => vi.fn());
const openUrlMock = vi.hoisted(() => vi.fn());
const openChromiumMock = vi.hoisted(() => vi.fn());
const nativeMock = vi.hoisted(() => ({ value: true }));
vi.mock("../../src/lib/codex", () => ({
  isDesktopApp: () => nativeMock.value,
  request: requestMock,
  subscribeAppServerMessages: subscribeMock,
}));
vi.mock("../../src/lib/nativeBridge", () => ({ openUrl: openUrlMock }));
vi.mock("../../src/lib/useChromium", () => ({
  openInChromium: openChromiumMock,
}));

import { I18nProvider } from "../../src/i18n/I18nProvider";
import { useAccount } from "../../src/lib/useAccount";

function EnglishProvider({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

beforeEach(() => {
  requestMock.mockReset();
  subscribeMock.mockReset();
  subscribeMock.mockReturnValue(vi.fn());
  openUrlMock.mockReset();
  openUrlMock.mockResolvedValue(undefined);
  openChromiumMock.mockReset().mockResolvedValue(undefined);
  nativeMock.value = true;
  localStorage.clear();
});

describe("compte Codex", () => {
  it("charge l’identité et l’utilisation", async () => {
    requestMock.mockImplementation((method: string) =>
      Promise.resolve(
        method === "account/read"
          ? {
              account: {
                type: "chatgpt",
                email: "dev@example.com",
                planType: "pro",
              },
              requiresOpenaiAuth: true,
            }
          : method === "account/usage/read"
            ? {
                summary: { lifetimeTokens: 1234 },
                dailyUsageBuckets: [{ startDate: "2026-07-19", tokens: 12 }],
              }
            : {
                featureEnabled: true,
                messages: [
                  {
                    messageId: "message-1",
                    messageType: "headline",
                    messageBody: "Maintenance planifiée",
                    createdAt: 1,
                    archivedAt: null,
                  },
                ],
              },
      ),
    );
    const { result } = renderHook(() => useAccount(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.account?.account).toMatchObject({
      email: "dev@example.com",
    });
    expect(result.current.usage?.dailyUsageBuckets).toHaveLength(1);
    expect(result.current.workspaceMessages?.messages[0].messageBody).toBe(
      "Maintenance planifiée",
    );
  });

  it("se rafraîchit après un changement de compte", async () => {
    requestMock.mockImplementation((method: string) =>
      Promise.resolve(
        method === "account/workspaceMessages/read"
          ? { featureEnabled: false, messages: [] }
          : { account: null, requiresOpenaiAuth: true },
      ),
    );
    renderHook(() => useAccount(true));
    await waitFor(() => expect(subscribeMock).toHaveBeenCalledOnce());
    const before = requestMock.mock.calls.length;
    act(() => subscribeMock.mock.calls[0][0]({ method: "account/updated" }));
    await waitFor(() =>
      expect(requestMock.mock.calls.length).toBeGreaterThan(before),
    );
  });

  it("ouvre, annule et finalise un flux ChatGPT identifié", async () => {
    requestMock.mockImplementation((method: string) =>
      Promise.resolve(
        method === "account/login/start"
          ? {
              type: "chatgpt",
              loginId: "login-1",
              authUrl: "https://chatgpt.com/auth",
            }
          : method === "account/workspaceMessages/read"
            ? { featureEnabled: false, messages: [] }
            : { account: null, requiresOpenaiAuth: true },
      ),
    );
    const { result } = renderHook(() => useAccount(true));
    await waitFor(() => expect(subscribeMock).toHaveBeenCalledOnce());
    await act(async () => result.current.startLogin());
    expect(openChromiumMock).toHaveBeenCalledWith("https://chatgpt.com/auth");
    expect(openUrlMock).not.toHaveBeenCalled();
    expect(result.current.authOpenMode).toBe("chromium");
    expect(result.current.authPending?.loginId).toBe("login-1");

    act(() =>
      subscribeMock.mock.calls[0][0]({
        method: "account/login/completed",
        params: { loginId: "other-login", success: false, error: "autre" },
      }),
    );
    expect(result.current.authPending?.loginId).toBe("login-1");
    act(() =>
      subscribeMock.mock.calls.at(-1)?.[0]({
        method: "account/login/completed",
        params: { loginId: "login-1", success: true, error: null },
      }),
    );
    await waitFor(() => expect(result.current.authPending).toBeNull());
  });

  it("rabat la connexion ChatGPT sur le navigateur système", async () => {
    openChromiumMock.mockRejectedValueOnce(new Error("chromium absent"));
    requestMock.mockResolvedValueOnce({
      type: "chatgpt",
      loginId: "login-system",
      authUrl: "https://chatgpt.com/system",
    });
    const { result } = renderHook(() => useAccount(false));

    await act(async () => result.current.startLogin());

    expect(openUrlMock).toHaveBeenCalledWith("https://chatgpt.com/system");
    expect(result.current.authOpenMode).toBe("system");
  });

  it("localise les indisponibilités du compte en anglais", async () => {
    localStorage.setItem("codex-desktop.locale", "en");
    requestMock.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useAccount(true), {
      wrapper: EnglishProvider,
    });

    await waitFor(() =>
      expect(result.current.error).toBe(
        "Some account information is unavailable.",
      ),
    );
  });

  it("localise les erreurs de connexion natives et inattendues", async () => {
    localStorage.setItem("codex-desktop.locale", "en");
    nativeMock.value = false;
    const nativeOnly = renderHook(() => useAccount(false), {
      wrapper: EnglishProvider,
    });

    await act(async () => nativeOnly.result.current.refresh());
    expect(nativeOnly.result.current.error).toBe(
      "Open the native app to read the Codex account.",
    );
    await act(async () => nativeOnly.result.current.startLogin());
    expect(nativeOnly.result.current.authError).toBe(
      "Open the native app to sign in.",
    );

    nativeOnly.unmount();
    nativeMock.value = true;
    requestMock.mockResolvedValue({ type: "apiKey" });
    const unexpected = renderHook(() => useAccount(false), {
      wrapper: EnglishProvider,
    });
    await act(async () => unexpected.result.current.startLogin());
    expect(unexpected.result.current.authError).toBe(
      "App Server did not start the expected ChatGPT flow.",
    );
  });

  it("localise l’échec de connexion sans message serveur", async () => {
    localStorage.setItem("codex-desktop.locale", "en");
    requestMock.mockImplementation((method: string) =>
      Promise.resolve(
        method === "account/login/start"
          ? {
              type: "chatgpt",
              loginId: "login-english",
              authUrl: "https://chatgpt.com/auth",
            }
          : method === "account/workspaceMessages/read"
            ? { featureEnabled: false, messages: [] }
            : { account: null, requiresOpenaiAuth: true },
      ),
    );
    const { result } = renderHook(() => useAccount(true), {
      wrapper: EnglishProvider,
    });
    await act(async () => result.current.startLogin());
    await waitFor(() => expect(subscribeMock).toHaveBeenCalled());

    act(() =>
      subscribeMock.mock.calls.at(-1)?.[0]({
        method: "account/login/completed",
        params: { loginId: "login-english", success: false },
      }),
    );

    expect(result.current.authError).toBe("ChatGPT sign-in failed.");
  });
});
