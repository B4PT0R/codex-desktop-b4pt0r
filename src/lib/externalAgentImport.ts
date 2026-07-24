import type {
  ExternalAgentImportFailure,
  ExternalAgentImportHistory,
  ExternalAgentImportSuccess,
  ExternalAgentImportTypeResult,
  ExternalAgentMigrationDetails,
  ExternalAgentMigrationItem,
  ExternalAgentMigrationItemType,
} from "./appServerTypes";

const itemTypes = new Set<ExternalAgentMigrationItemType>([
  "AGENTS_MD",
  "CONFIG",
  "SKILLS",
  "PLUGINS",
  "MCP_SERVER_CONFIG",
  "SUBAGENTS",
  "HOOKS",
  "COMMANDS",
  "MEMORY",
  "SESSIONS",
]);

export function externalAgentItemKey(
  item: ExternalAgentMigrationItem,
  index: number,
) {
  return `${item.itemType}\u0000${item.cwd ?? ""}\u0000${item.description}\u0000${index}`;
}

export function normalizeExternalAgentItems(
  value: unknown,
): ExternalAgentMigrationItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 500)
    .flatMap((candidate) => {
      const record = asRecord(candidate);
      if (
        !record ||
        !isItemType(record.itemType) ||
        typeof record.description !== "string"
      )
        return [];
      return [
        {
          itemType: record.itemType,
          description: bounded(record.description, 4_000),
          cwd: nullableString(record.cwd, 32_768),
          details: normalizeDetails(record.details),
        },
      ];
    });
}

export function normalizeExternalAgentResults(
  value: unknown,
): ExternalAgentImportTypeResult[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).flatMap((candidate) => {
    const record = asRecord(candidate);
    if (!record || !isItemType(record.itemType)) return [];
    return [
      {
        itemType: record.itemType,
        successes: normalizeSuccesses(record.successes),
        failures: normalizeFailures(record.failures),
      },
    ];
  });
}

export function normalizeExternalAgentHistories(
  value: unknown,
): ExternalAgentImportHistory[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).flatMap((candidate) => {
    const record = asRecord(candidate);
    if (
      !record ||
      typeof record.importId !== "string" ||
      typeof record.completedAtMs !== "number" ||
      !Number.isFinite(record.completedAtMs)
    )
      return [];
    return [
      {
        importId: bounded(record.importId, 512),
        completedAtMs: record.completedAtMs,
        successes: normalizeSuccesses(record.successes),
        failures: normalizeFailures(record.failures),
      },
    ];
  });
}

export function externalAgentResultTotals(
  results: ExternalAgentImportTypeResult[],
) {
  return results.reduce(
    (totals, result) => ({
      successes: totals.successes + result.successes.length,
      failures: totals.failures + result.failures.length,
    }),
    { successes: 0, failures: 0 },
  );
}

export function externalAgentHistoryResults(
  history: ExternalAgentImportHistory,
): ExternalAgentImportTypeResult[] {
  const types = new Set([
    ...history.successes.map((item) => item.itemType),
    ...history.failures.map((item) => item.itemType),
  ]);
  return [...types].map((itemType) => ({
    itemType,
    successes: history.successes.filter((item) => item.itemType === itemType),
    failures: history.failures.filter((item) => item.itemType === itemType),
  }));
}

export function externalAgentDetailNames(
  details: ExternalAgentMigrationDetails | null | undefined,
) {
  if (!details) return [];
  return [
    ...(details.plugins ?? []).flatMap((plugin) => plugin.pluginNames),
    ...(details.skills ?? []).map((item) => item.name),
    ...(details.sessions ?? []).map((item) => item.title || item.cwd),
    ...(details.mcpServers ?? []).map((item) => item.name),
    ...(details.hooks ?? []).map((item) => item.name),
    ...(details.subagents ?? []).map((item) => item.name),
    ...(details.commands ?? []).map((item) => item.name),
    ...(details.memory ?? []),
  ].slice(0, 12);
}

function normalizeDetails(value: unknown): ExternalAgentMigrationDetails | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    plugins: namedPlugins(record.plugins),
    skills: namedValues(record.skills),
    sessions: sessionValues(record.sessions),
    mcpServers: namedValues(record.mcpServers),
    hooks: namedValues(record.hooks),
    subagents: namedValues(record.subagents),
    commands: namedValues(record.commands),
    memory: stringValues(record.memory),
  };
}

function normalizeSuccesses(value: unknown): ExternalAgentImportSuccess[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 500).flatMap((candidate) => {
    const record = asRecord(candidate);
    if (!record || !isItemType(record.itemType)) return [];
    return [
      {
        itemType: record.itemType,
        cwd: nullableString(record.cwd, 32_768),
        source: nullableString(record.source, 2_000),
        target: nullableString(record.target, 32_768),
      },
    ];
  });
}

function normalizeFailures(value: unknown): ExternalAgentImportFailure[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 500).flatMap((candidate) => {
    const record = asRecord(candidate);
    if (
      !record ||
      !isItemType(record.itemType) ||
      typeof record.failureStage !== "string" ||
      typeof record.message !== "string"
    )
      return [];
    return [
      {
        itemType: record.itemType,
        failureStage: bounded(record.failureStage, 512),
        message: bounded(record.message, 8_000),
        errorType: nullableString(record.errorType, 512),
        subErrorType: nullableString(record.subErrorType, 512),
        cwd: nullableString(record.cwd, 32_768),
        source: nullableString(record.source, 2_000),
      },
    ];
  });
}

function namedValues(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 500).flatMap((candidate) => {
    const record = asRecord(candidate);
    return record && typeof record.name === "string"
      ? [{ name: bounded(record.name, 1_000) }]
      : [];
  });
}

function namedPlugins(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 200).flatMap((candidate) => {
    const record = asRecord(candidate);
    if (!record || typeof record.marketplaceName !== "string") return [];
    return [
      {
        marketplaceName: bounded(record.marketplaceName, 1_000),
        pluginNames: stringValues(record.pluginNames),
      },
    ];
  });
}

function sessionValues(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 500).flatMap((candidate) => {
    const record = asRecord(candidate);
    if (
      !record ||
      typeof record.path !== "string" ||
      typeof record.cwd !== "string"
    )
      return [];
    return [
      {
        path: bounded(record.path, 32_768),
        cwd: bounded(record.cwd, 32_768),
        title: nullableString(record.title, 2_000),
      },
    ];
  });
}

function stringValues(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, 500)
    .map((item) => bounded(item, 2_000));
}

function isItemType(value: unknown): value is ExternalAgentMigrationItemType {
  return typeof value === "string" && itemTypes.has(value as ExternalAgentMigrationItemType);
}

function nullableString(value: unknown, maxLength: number) {
  return typeof value === "string" ? bounded(value, maxLength) : null;
}

function bounded(value: string, maxLength: number) {
  return value.slice(0, maxLength);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
