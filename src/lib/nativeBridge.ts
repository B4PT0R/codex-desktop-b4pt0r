export type NativeEvent<T> = { payload: T };
export type UnlistenFn = () => void;

type ElectronDesktop = {
  invoke<T>(command: string, args?: unknown): Promise<T>;
  listen<T>(
    event: string,
    handler: (payload: T) => void,
  ): Promise<UnlistenFn>;
  openDialog(options: Record<string, unknown>): Promise<string | string[] | null>;
  openPath(path: string): Promise<void>;
  openUrl(url: string): Promise<void>;
};

declare global {
  interface Window {
    electronDesktop?: ElectronDesktop;
  }
}

export function isDesktopApp() {
  return typeof window !== "undefined" && Boolean(window.electronDesktop);
}

function desktopBridge(): ElectronDesktop {
  if (!isDesktopApp() || !window.electronDesktop) {
    throw new Error("This action is only available in the Electron desktop app");
  }
  return window.electronDesktop;
}

export function invoke<T>(command: string, args?: unknown): Promise<T> {
  return desktopBridge().invoke<T>(command, args);
}

export function listen<T>(
  event: string,
  handler: (event: NativeEvent<T>) => void,
): Promise<UnlistenFn> {
  return desktopBridge().listen<T>(event, (payload) => handler({ payload }));
}

export function openDialog(
  options: Record<string, unknown>,
): Promise<string | string[] | null> {
  return desktopBridge().openDialog(options);
}

export function openPath(path: string) {
  return desktopBridge().openPath(path);
}

export function openUrl(url: string) {
  return desktopBridge().openUrl(url);
}
