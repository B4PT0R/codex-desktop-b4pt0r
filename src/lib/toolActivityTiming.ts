export const TOOL_COMPLETION_DWELL_MS = 1_200;
export const TOOL_COLLAPSE_MS = 260;
export const TOOL_GROUP_DWELL_MS = 1_700;
export const TOOL_GROUP_COLLAPSE_MS = 280;

export const CLOSED_STEP_TOOL_DWELL_MS = 120;
export const CLOSED_STEP_GROUP_DWELL_MS = 200;
export function closedStepRevealDelay(toolCount: number) {
  return (
    Math.max(1, toolCount) *
      (CLOSED_STEP_TOOL_DWELL_MS + TOOL_COLLAPSE_MS) +
    CLOSED_STEP_GROUP_DWELL_MS +
    TOOL_GROUP_COLLAPSE_MS +
    40
  );
}
