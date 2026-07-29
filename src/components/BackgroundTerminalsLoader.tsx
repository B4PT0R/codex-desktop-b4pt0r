import { lazy, Suspense } from "react";
import type { BackgroundTerminalsController } from "../lib/useBackgroundTerminals";

const BackgroundTerminalsButton = lazy(() =>
  import("./BackgroundTerminalsButton").then((module) => ({
    default: module.BackgroundTerminalsButton,
  })),
);

export function BackgroundTerminalsLoader(props: {
  controller: BackgroundTerminalsController;
  threadId?: string;
}) {
  if (!props.threadId) return null;
  return (
    <Suspense fallback={null}>
      <BackgroundTerminalsButton {...props} />
    </Suspense>
  );
}
