import { Plus, Server, SlidersHorizontal, Zap } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { McpServerDraft } from "../lib/protocol";
import { useDialogFocus } from "../lib/useDialogFocus";
import { RoundIcon, RoundIconButton } from "./RoundIcon";

type Tab = "essential" | "advanced";

export function McpServerAddDialog({
  adding,
  existingNames,
  onAdd,
  onCancel,
}: {
  adding: boolean;
  existingNames: string[];
  onAdd: (draft: McpServerDraft) => Promise<boolean>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("essential");
  const [name, setName] = useState("");
  const [transport, setTransport] = useState<"stdio" | "http">("stdio");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [cwd, setCwd] = useState("");
  const [env, setEnv] = useState("");
  const [envVars, setEnvVars] = useState("");
  const [url, setUrl] = useState("");
  const [bearerTokenEnvVar, setBearerTokenEnvVar] = useState("");
  const [httpHeaders, setHttpHeaders] = useState("");
  const [envHttpHeaders, setEnvHttpHeaders] = useState("");
  const [startupTimeout, setStartupTimeout] = useState("");
  const [toolTimeout, setToolTimeout] = useState("");
  const [approvalMode, setApprovalMode] = useState("");
  const [enabledTools, setEnabledTools] = useState("");
  const [disabledTools, setDisabledTools] = useState("");

  const validName = /^[A-Za-z0-9_-]+$/.test(name);
  const duplicateName = existingNames.includes(name);
  const validEnvironment = validKeyValueLines(env);
  const validHeaders = validKeyValueLines(httpHeaders);
  const validEnvironmentHeaders = validKeyValueLines(envHttpHeaders, true);
  const validBearerTokenEnvVar = validOptionalEnvironmentName(bearerTokenEnvVar);
  const validTimeouts = validOptionalPositiveNumber(startupTimeout)
    && validOptionalPositiveNumber(toolTimeout);
  const valid = validName && !duplicateName && validTimeouts && (
    transport === "stdio"
      ? Boolean(command.trim()) && validEnvironment
      : validHttpUrl(url) && validBearerTokenEnvVar && validHeaders
        && validEnvironmentHeaders
  );
  const { dialogRef, onDialogKeyDown } = useDialogFocus<HTMLFormElement>({
    initialFocusSelector: "[data-dialog-initial-focus]",
    onEscape: adding ? undefined : onCancel,
  });

  const submit = async () => {
    if (!valid) return;
    const shared = {
      ...(parsePositiveNumber(startupTimeout) !== undefined
        ? { startupTimeoutSec: parsePositiveNumber(startupTimeout) }
        : {}),
      ...(parsePositiveNumber(toolTimeout) !== undefined
        ? { toolTimeoutSec: parsePositiveNumber(toolTimeout) }
        : {}),
      ...(approvalMode
        ? { defaultToolsApprovalMode: approvalMode as "auto" | "prompt" | "writes" | "approve" }
        : {}),
      ...(parseLines(enabledTools).length ? { enabledTools: parseLines(enabledTools) } : {}),
      ...(parseLines(disabledTools).length ? { disabledTools: parseLines(disabledTools) } : {}),
    };
    const draft: McpServerDraft = transport === "stdio"
      ? {
          name,
          transport,
          command: command.trim(),
          args: parseLines(args),
          ...(cwd.trim() ? { cwd: cwd.trim() } : {}),
          ...(parseKeyValueLines(env) ? { env: parseKeyValueLines(env) } : {}),
          ...(parseLines(envVars).length ? { envVars: parseLines(envVars) } : {}),
          ...shared,
        }
      : {
          name,
          transport,
          url: url.trim(),
          ...(bearerTokenEnvVar.trim()
            ? { bearerTokenEnvVar: bearerTokenEnvVar.trim() }
            : {}),
          ...(parseKeyValueLines(httpHeaders)
            ? { httpHeaders: parseKeyValueLines(httpHeaders) }
            : {}),
          ...(parseKeyValueLines(envHttpHeaders)
            ? { envHttpHeaders: parseKeyValueLines(envHttpHeaders) }
            : {}),
          ...shared,
        };
    if (await onAdd(draft)) onCancel();
  };

  return (
    <div className="overlay">
      <form
        ref={dialogRef}
        className="modal mcp-add-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-add-title"
        onKeyDown={onDialogKeyDown}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="mcp-add-dialog-heading">
          <RoundIcon icon={Server} size="large" variant="primary" />
          <h2 id="mcp-add-title">{t("integrations.mcp.addTitle")}</h2>
        </div>
        <div className="mcp-add-dialog-body">
          <p>{t("integrations.mcp.addDetail")}</p>
          <div className="mcp-add-tabs" role="tablist" aria-label={t("integrations.mcp.addLevel")}>
            {([
              { value: "essential", icon: Zap },
              { value: "advanced", icon: SlidersHorizontal },
            ] as const).map(({ value, icon: Icon }) => (
              <button
                aria-controls={`mcp-add-${value}`}
                aria-selected={tab === value}
                className={tab === value ? "active" : undefined}
                disabled={adding}
                id={`mcp-add-tab-${value}`}
                key={value}
                onClick={() => setTab(value)}
                role="tab"
                type="button"
              >
                <Icon aria-hidden="true" />
                <span>{t(`integrations.mcp.addLevel.${value}`)}</span>
              </button>
            ))}
          </div>
          <div
            aria-labelledby={`mcp-add-tab-${tab}`}
            className="mcp-add-fields"
            id={`mcp-add-${tab}`}
            role="tabpanel"
          >
            {tab === "essential" ? (
              <EssentialFields
                adding={adding}
                bearerTokenEnvVar={bearerTokenEnvVar}
                command={command}
                cwd={cwd}
                duplicateName={duplicateName}
                env={env}
                name={name}
                setBearerTokenEnvVar={setBearerTokenEnvVar}
                setCommand={setCommand}
                setCwd={setCwd}
                setEnv={setEnv}
                setName={setName}
                setTransport={setTransport}
                setUrl={setUrl}
                transport={transport}
                validBearerTokenEnvVar={validBearerTokenEnvVar}
                validEnvironment={validEnvironment}
                validName={validName}
                url={url}
                args={args}
                setArgs={setArgs}
              />
            ) : (
              <AdvancedFields
                adding={adding}
                approvalMode={approvalMode}
                disabledTools={disabledTools}
                enabledTools={enabledTools}
                envHttpHeaders={envHttpHeaders}
                envVars={envVars}
                httpHeaders={httpHeaders}
                setApprovalMode={setApprovalMode}
                setDisabledTools={setDisabledTools}
                setEnabledTools={setEnabledTools}
                setEnvHttpHeaders={setEnvHttpHeaders}
                setEnvVars={setEnvVars}
                setHttpHeaders={setHttpHeaders}
                setStartupTimeout={setStartupTimeout}
                setToolTimeout={setToolTimeout}
                startupTimeout={startupTimeout}
                toolTimeout={toolTimeout}
                transport={transport}
                validEnvironmentHeaders={validEnvironmentHeaders}
                validHeaders={validHeaders}
                validTimeouts={validTimeouts}
              />
            )}
          </div>
        </div>
        <div className="modal-actions">
          <RoundIconButton disabled={adding} label={t("common.cancel")} onClick={onCancel} variant="secondary" />
          <RoundIconButton disabled={!valid || adding} icon={Plus} label={adding ? t("integrations.mcp.adding") : t("integrations.mcp.addAction")} type="submit" variant="primary" />
        </div>
      </form>
    </div>
  );
}

type Setter = (value: string) => void;

function EssentialFields(props: {
  adding: boolean; args: string; bearerTokenEnvVar: string; command: string;
  cwd: string; duplicateName: boolean; env: string; name: string;
  setArgs: Setter; setBearerTokenEnvVar: Setter; setCommand: Setter; setCwd: Setter;
  setEnv: Setter; setName: Setter; setTransport: (value: "stdio" | "http") => void;
  setUrl: Setter; transport: "stdio" | "http"; url: string;
  validBearerTokenEnvVar: boolean; validEnvironment: boolean; validName: boolean;
}) {
  const { t } = useI18n();
  const p = props;
  return <>
    <Field label={t("integrations.mcp.addName")}>
      <input data-dialog-initial-focus autoComplete="off" disabled={p.adding} value={p.name} onChange={(event) => p.setName(event.target.value)} />
      {p.name && !p.validName && <small>{t("integrations.mcp.addNameError")}</small>}
      {p.duplicateName && <small>{t("integrations.mcp.addNameDuplicate")}</small>}
    </Field>
    <Field label={t("integrations.mcp.addType")}>
      <select disabled={p.adding} value={p.transport} onChange={(event) => p.setTransport(event.target.value as "stdio" | "http")}>
        <option value="stdio">{t("integrations.mcp.addType.stdio")}</option>
        <option value="http">{t("integrations.mcp.addType.http")}</option>
      </select>
    </Field>
    {p.transport === "stdio" ? <>
      <Field label={t("integrations.mcp.addCommand")}><input disabled={p.adding} value={p.command} onChange={(event) => p.setCommand(event.target.value)} /></Field>
      <Field detail={t("integrations.mcp.addArgsDetail")} label={t("integrations.mcp.addArgs")}><textarea disabled={p.adding} value={p.args} onChange={(event) => p.setArgs(event.target.value)} /></Field>
      <Field label={t("integrations.mcp.addCwd")}><input disabled={p.adding} value={p.cwd} onChange={(event) => p.setCwd(event.target.value)} /></Field>
      <Field detail={t("integrations.mcp.addEnvDetail")} error={!p.validEnvironment ? t("integrations.mcp.addEnvError") : undefined} label={t("integrations.mcp.addEnv")}><textarea disabled={p.adding} value={p.env} onChange={(event) => p.setEnv(event.target.value)} /></Field>
    </> : <>
      <Field label={t("integrations.mcp.addUrl")}><input disabled={p.adding} inputMode="url" value={p.url} onChange={(event) => p.setUrl(event.target.value)} /></Field>
      <Field detail={t("integrations.mcp.addBearerEnvDetail")} error={!p.validBearerTokenEnvVar ? t("integrations.mcp.addBearerEnvError") : undefined} label={t("integrations.mcp.addBearerEnv")}><input disabled={p.adding} value={p.bearerTokenEnvVar} onChange={(event) => p.setBearerTokenEnvVar(event.target.value)} /></Field>
    </>}
  </>;
}

function AdvancedFields(props: {
  adding: boolean; approvalMode: string; disabledTools: string; enabledTools: string;
  envHttpHeaders: string; envVars: string; httpHeaders: string; setApprovalMode: Setter;
  setDisabledTools: Setter; setEnabledTools: Setter; setEnvHttpHeaders: Setter;
  setEnvVars: Setter; setHttpHeaders: Setter; setStartupTimeout: Setter;
  setToolTimeout: Setter; startupTimeout: string; toolTimeout: string;
  transport: "stdio" | "http"; validEnvironmentHeaders: boolean;
  validHeaders: boolean; validTimeouts: boolean;
}) {
  const { t } = useI18n();
  const p = props;
  return <>
    <div className="mcp-add-field-grid">
      <Field error={!p.validTimeouts ? t("integrations.mcp.addTimeoutError") : undefined} label={t("integrations.mcp.addStartupTimeout")}><input disabled={p.adding} inputMode="decimal" value={p.startupTimeout} onChange={(event) => p.setStartupTimeout(event.target.value)} /></Field>
      <Field label={t("integrations.mcp.addToolTimeout")}><input disabled={p.adding} inputMode="decimal" value={p.toolTimeout} onChange={(event) => p.setToolTimeout(event.target.value)} /></Field>
    </div>
    <Field detail={t("integrations.mcp.addApprovalDetail")} label={t("integrations.mcp.addApproval")}>
      <select disabled={p.adding} value={p.approvalMode} onChange={(event) => p.setApprovalMode(event.target.value)}>
        <option value="">{t("integrations.mcp.addApproval.default")}</option>
        {(["auto", "prompt", "writes", "approve"] as const).map((value) => <option key={value} value={value}>{t(`integrations.mcp.addApproval.${value}`)}</option>)}
      </select>
    </Field>
    <div className="mcp-add-field-grid">
      <Field detail={t("integrations.mcp.addToolsDetail")} label={t("integrations.mcp.addEnabledTools")}><textarea disabled={p.adding} value={p.enabledTools} onChange={(event) => p.setEnabledTools(event.target.value)} /></Field>
      <Field detail={t("integrations.mcp.addToolsDetail")} label={t("integrations.mcp.addDisabledTools")}><textarea disabled={p.adding} value={p.disabledTools} onChange={(event) => p.setDisabledTools(event.target.value)} /></Field>
    </div>
    {p.transport === "stdio" ?
      <Field detail={t("integrations.mcp.addEnvVarsDetail")} label={t("integrations.mcp.addEnvVars")}><textarea disabled={p.adding} value={p.envVars} onChange={(event) => p.setEnvVars(event.target.value)} /></Field>
      : <div className="mcp-add-field-grid">
        <Field detail={t("integrations.mcp.addHeadersDetail")} error={!p.validHeaders ? t("integrations.mcp.addEnvError") : undefined} label={t("integrations.mcp.addHeaders")}><textarea disabled={p.adding} value={p.httpHeaders} onChange={(event) => p.setHttpHeaders(event.target.value)} /></Field>
        <Field detail={t("integrations.mcp.addEnvHeadersDetail")} error={!p.validEnvironmentHeaders ? t("integrations.mcp.addEnvHeaderError") : undefined} label={t("integrations.mcp.addEnvHeaders")}><textarea disabled={p.adding} value={p.envHttpHeaders} onChange={(event) => p.setEnvHttpHeaders(event.target.value)} /></Field>
      </div>}
  </>;
}

function Field({ children, detail, error, label }: { children: ReactNode; detail?: string; error?: string; label: string }) {
  return <label><span>{label}</span>{children}{detail && <small>{detail}</small>}{error && <small className="field-error">{error}</small>}</label>;
}

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function validKeyValueLines(value: string, environmentValue = false) {
  return parseLines(value).every((line) => {
    const separator = line.indexOf("=");
    if (separator <= 0) return false;
    return !environmentValue || /^[A-Za-z_][A-Za-z0-9_]*$/.test(line.slice(separator + 1).trim());
  });
}

function parseKeyValueLines(value: string) {
  const entries = parseLines(value);
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries.map((entry) => {
    const separator = entry.indexOf("=");
    return [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()];
  }));
}

function validOptionalEnvironmentName(value: string) {
  return !value.trim() || /^[A-Za-z_][A-Za-z0-9_]*$/.test(value.trim());
}

function validOptionalPositiveNumber(value: string) {
  return !value.trim() || (Number.isFinite(Number(value)) && Number(value) > 0);
}

function parsePositiveNumber(value: string) {
  return value.trim() ? Number(value) : undefined;
}
