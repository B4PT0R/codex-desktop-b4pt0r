const HEADER = "[Codex Desktop Scheduler]";
const TASK_PREFIX = "Scheduled task: ";
const EXPLANATION =
  "This turn was started automatically at the scheduled time. Treat it as scheduled work, not as a user steering message.";

export type ScheduledTaskMessage = {
  name: string;
  prompt: string;
};

export function scheduledTaskPrompt(name: string, prompt: string) {
  return [
    HEADER,
    `${TASK_PREFIX}${JSON.stringify(name)}`,
    EXPLANATION,
    "",
    prompt,
  ].join("\n");
}

export function scheduledTaskFromPrompt(
  value: string,
): ScheduledTaskMessage | undefined {
  const [header, taskLine, explanation, separator, ...promptLines] =
    value.split("\n");
  if (
    header !== HEADER ||
    !taskLine?.startsWith(TASK_PREFIX) ||
    explanation !== EXPLANATION ||
    separator !== ""
  ) {
    return undefined;
  }
  try {
    const name = JSON.parse(taskLine.slice(TASK_PREFIX.length));
    if (typeof name !== "string" || !name.trim()) return undefined;
    return { name, prompt: promptLines.join("\n") };
  } catch {
    return undefined;
  }
}
