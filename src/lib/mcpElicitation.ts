import type { AppServerMessage } from "./codex";

export type McpElicitationField =
  | TextElicitationField
  | NumberElicitationField
  | BooleanElicitationField
  | SelectElicitationField
  | MultiSelectElicitationField;

type FieldBase = {
  id: string;
  title: string;
  description?: string;
  required: boolean;
};

export type TextElicitationField = FieldBase & {
  kind: "text";
  defaultValue: string;
  format?: "email" | "uri" | "date" | "date-time";
  minLength?: number;
  maxLength?: number;
};

export type NumberElicitationField = FieldBase & {
  kind: "number";
  defaultValue?: number;
  integer: boolean;
  minimum?: number;
  maximum?: number;
};

export type BooleanElicitationField = FieldBase & {
  kind: "boolean";
  defaultValue: boolean;
};

type ElicitationOption = { value: string; label: string };

export type SelectElicitationField = FieldBase & {
  kind: "select";
  defaultValue?: string;
  options: ElicitationOption[];
};

export type MultiSelectElicitationField = FieldBase & {
  kind: "multi-select";
  defaultValue: string[];
  minItems?: number;
  maxItems?: number;
  options: ElicitationOption[];
};

export type McpElicitationRequest = {
  requestId: string | number;
  serverName: string;
  message: string;
  mode: "form" | "url" | "unsupported";
  fields: McpElicitationField[];
  url?: string;
  isToolApproval: boolean;
  persistModes: Array<"session" | "always">;
  toolTitle?: string;
  toolDescription?: string;
  details: Array<{ label: string; value: string }>;
};

export type McpElicitationResponse = {
  action: "accept" | "decline" | "cancel";
  content: Record<string, unknown> | null;
  _meta: { persist: "session" | "always" } | null;
};

const maxFields = 50;
const maxOptions = 100;

export function mcpElicitationFromMessage(
  message: AppServerMessage,
): McpElicitationRequest | undefined {
  if (
    message.method !== "mcpServer/elicitation/request" ||
    (typeof message.id !== "string" && typeof message.id !== "number")
  ) {
    return undefined;
  }
  const params = record(message.params);
  const serverName = boundedString(params?.serverName, 256) ?? "MCP";
  const prompt = boundedString(params?.message, 8_000) ?? "";
  const meta = record(params?._meta);
  const common = {
    requestId: message.id,
    serverName,
    message: prompt,
    isToolApproval: meta?.codex_approval_kind === "mcp_tool_call",
    persistModes: persistModes(meta?.persist),
    ...toolMetadata(meta),
  };
  if (params?.mode === "url") {
    const url = safeHttpUrl(params.url);
    return {
      ...common,
      mode: url ? "url" : "unsupported",
      fields: [],
      ...(url ? { url } : {}),
    };
  }
  if (params?.mode !== "form") {
    return { ...common, mode: "unsupported", fields: [] };
  }
  const fields = fieldsFromSchema(params.requestedSchema);
  return fields
    ? { ...common, mode: "form", fields }
    : { ...common, mode: "unsupported", fields: [] };
}

export function mcpElicitationResponse(
  action: "accept" | "decline" | "cancel",
  content?: Record<string, unknown>,
  persist?: "session" | "always",
): McpElicitationResponse {
  return {
    action,
    content: action === "accept" ? (content ?? null) : null,
    _meta: action === "accept" && persist ? { persist } : null,
  };
}

function fieldsFromSchema(value: unknown): McpElicitationField[] | undefined {
  const schema = record(value);
  const properties = record(schema?.properties);
  if (schema?.type !== "object" || !properties) return undefined;
  const entries = Object.entries(properties);
  if (entries.length > maxFields) return undefined;
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((item): item is string => typeof item === "string")
      : [],
  );
  const fields: McpElicitationField[] = [];
  for (const [id, fieldSchema] of entries) {
    const field = fieldFromSchema(id, fieldSchema, required.has(id));
    if (!field) return undefined;
    fields.push(field);
  }
  return fields;
}

function fieldFromSchema(
  id: string,
  value: unknown,
  required: boolean,
): McpElicitationField | undefined {
  const schema = record(value);
  if (!schema || id.length > 256) return undefined;
  const base = {
    id,
    title: boundedString(schema.title, 256) ?? id,
    description: boundedString(schema.description, 1_000),
    required,
  };
  const multiOptions = optionsFromItems(schema.items);
  if (schema.type === "array" && multiOptions) {
    return {
      ...base,
      kind: "multi-select",
      options: multiOptions,
      defaultValue: stringArray(schema.default, multiOptions),
      minItems: boundedInteger(schema.minItems),
      maxItems: boundedInteger(schema.maxItems),
    };
  }
  const options = optionsFromSchema(schema);
  if (schema.type === "string" && options) {
    return {
      ...base,
      kind: "select",
      options,
      defaultValue: optionDefault(schema.default, options),
    };
  }
  if (schema.type === "string") {
    const format =
      schema.format === "email" ||
      schema.format === "uri" ||
      schema.format === "date" ||
      schema.format === "date-time"
        ? schema.format
        : undefined;
    return {
      ...base,
      kind: "text",
      defaultValue: boundedString(schema.default, 32_768) ?? "",
      format,
      minLength: boundedInteger(schema.minLength),
      maxLength: boundedInteger(schema.maxLength),
    };
  }
  if (schema.type === "number" || schema.type === "integer") {
    return {
      ...base,
      kind: "number",
      integer: schema.type === "integer",
      defaultValue: finiteNumber(schema.default),
      minimum: finiteNumber(schema.minimum),
      maximum: finiteNumber(schema.maximum),
    };
  }
  if (schema.type === "boolean") {
    return {
      ...base,
      kind: "boolean",
      defaultValue: schema.default === true,
    };
  }
  return undefined;
}

function optionsFromSchema(schema: Record<string, unknown>) {
  if (Array.isArray(schema.oneOf)) return titledOptions(schema.oneOf);
  if (!Array.isArray(schema.enum) || schema.enum.length > maxOptions) {
    return undefined;
  }
  const values = schema.enum.filter(
    (item): item is string => typeof item === "string",
  );
  if (values.length !== schema.enum.length) return undefined;
  const names = Array.isArray(schema.enumNames) ? schema.enumNames : [];
  return values.map((value, index) => ({
    value,
    label: typeof names[index] === "string" ? names[index] : value,
  }));
}

function optionsFromItems(value: unknown) {
  const items = record(value);
  if (!items) return undefined;
  if (Array.isArray(items.anyOf)) return titledOptions(items.anyOf);
  if (Array.isArray(items.oneOf)) return titledOptions(items.oneOf);
  return optionsFromSchema(items);
}

function titledOptions(value: unknown[]) {
  if (value.length > maxOptions) return undefined;
  const options = value.map((item) => {
    const candidate = record(item);
    const optionValue = boundedString(candidate?.const, 1_000);
    const label = boundedString(candidate?.title, 256);
    return optionValue && label ? { value: optionValue, label } : undefined;
  });
  return options.every((option) => option !== undefined)
    ? (options as ElicitationOption[])
    : undefined;
}

function optionDefault(value: unknown, options: ElicitationOption[]) {
  return typeof value === "string" &&
    options.some((option) => option.value === value)
    ? value
    : undefined;
}

function stringArray(value: unknown, options: ElicitationOption[]) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === "string" &&
      options.some((option) => option.value === item),
  );
}

function persistModes(value: unknown): Array<"session" | "always"> {
  const values = Array.isArray(value) ? value : [value];
  return ["session", "always"].filter((mode) => values.includes(mode)) as Array<
    "session" | "always"
  >;
}

function toolMetadata(meta: Record<string, unknown> | undefined) {
  const toolTitle = boundedString(meta?.tool_title, 256);
  const toolDescription = boundedString(meta?.tool_description, 1_000);
  const display = Array.isArray(meta?.tool_params_display)
    ? meta.tool_params_display.slice(0, 12).flatMap((item) => {
        const param = record(item);
        const label =
          boundedString(param?.display_name, 256) ??
          boundedString(param?.name, 256);
        const value = boundedJson(param?.value, 1_000);
        return label && value !== undefined ? [{ label, value }] : [];
      })
    : [];
  const fallback = record(meta?.tool_params);
  const details =
    display.length > 0
      ? display
      : Object.entries(fallback ?? {})
          .slice(0, 12)
          .flatMap(([label, value]) => {
            const rendered = boundedJson(value, 1_000);
            return rendered === undefined ? [] : [{ label, value: rendered }];
          });
  return {
    ...(toolTitle ? { toolTitle } : {}),
    ...(toolDescription ? { toolDescription } : {}),
    details,
  };
}

function boundedJson(value: unknown, maxLength: number) {
  try {
    const rendered = typeof value === "string" ? value : JSON.stringify(value);
    return rendered.length <= maxLength ? rendered : undefined;
  } catch {
    return undefined;
  }
}

function safeHttpUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 8_192) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function boundedString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.length <= maxLength
    ? value
    : undefined;
}

function boundedInteger(value: unknown) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 1_000_000
    ? value
    : undefined;
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
