import { lazy, Suspense } from "react";

const BackgroundTerminalsButton = lazy(() =>
  import("./BackgroundTerminalsButton").then((module) => ({
    default: module.BackgroundTerminalsButton,
  })),
);

export function BackgroundTerminalsLoader(props: {
  busy: boolean;
  connected: boolean;
  threadId?: string;
}) {
  if (!props.threadId) return null;
  return (
    <Suspense fallback={null}>
      <BackgroundTerminalsButton {...props} />
    </Suspense>
  );
}
