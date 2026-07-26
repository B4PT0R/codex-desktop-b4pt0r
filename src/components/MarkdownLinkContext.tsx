import { createContext, useContext, type ReactNode } from "react";
import type { FileOpener } from "../lib/protocol";

export type MarkdownLinkRouting = {
  cwd?: string;
  fileOpener: FileOpener;
  onError: (error: unknown) => void;
};

const Context = createContext<MarkdownLinkRouting>({
  fileOpener: "none",
  onError: () => undefined,
});

export function MarkdownLinkProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: MarkdownLinkRouting;
}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useMarkdownLinkRouting() {
  return useContext(Context);
}
