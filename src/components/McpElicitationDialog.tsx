import { openUrl } from "../lib/nativeBridge";
import { ExternalLink, ListChecks } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useI18n } from "../i18n/I18nProvider";
import {
  mcpElicitationResponse,
  type McpElicitationField,
  type McpElicitationRequest,
  type McpElicitationResponse,
} from "../lib/mcpElicitation";
import { openInChromium } from "../lib/useChromium";
import { useDialogFocus } from "../lib/useDialogFocus";

type McpElicitationDialogProps = {
  request: McpElicitationRequest;
  submitting: boolean;
  onSubmit: (response: McpElicitationResponse) => void;
};

export function McpElicitationDialog({
  request,
  submitting,
  onSubmit,
}: McpElicitationDialogProps) {
  const { t } = useI18n();
  const [values, setValues] = useState(() => initialValues(request.fields));
  const [openError, setOpenError] = useState<string>();
  const { dialogRef, onDialogKeyDown } = useDialogFocus<HTMLFormElement>({
    initialFocusSelector: "input, select, button",
    onEscape: () => {
      if (!submitting) onSubmit(mcpElicitationResponse("cancel"));
    },
  });
  const titleId = `mcp-elicitation-${String(request.requestId)}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || request.mode === "unsupported") return;
    onSubmit(
      mcpElicitationResponse(
        "accept",
        request.fields.length > 0 ? responseContent(request, values) : undefined,
      ),
    );
  }

  async function openTarget(useSystem = false) {
    if (!request.url) return;
    setOpenError(undefined);
    try {
      if (useSystem) await openUrl(request.url);
      else await openInChromium(request.url);
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : String(error));
    }
  }

  const approvalOnly = request.isToolApproval && request.fields.length === 0;
  return (
    <div className="overlay">
      <form
        ref={dialogRef}
        className="modal mcp-elicitation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onDialogKeyDown}
        onSubmit={submit}
        tabIndex={-1}
      >
        <header>
          <span className="approval-icon">
            <ListChecks />
          </span>
          <span>
            <small>{t("mcpElicitation.server", { server: request.serverName })}</small>
            <h2 id={titleId}>
              {approvalOnly
                ? (request.toolTitle ?? t("mcpElicitation.approvalTitle"))
                : t("mcpElicitation.title")}
            </h2>
          </span>
        </header>
        {request.message && <p className="mcp-elicitation-message">{request.message}</p>}
        {request.toolDescription && (
          <p className="mcp-elicitation-tool-description">
            {request.toolDescription}
          </p>
        )}
        {request.details.length > 0 && (
          <dl className="mcp-elicitation-details">
            {request.details.map((detail) => (
              <div key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {request.mode === "form" && request.fields.length > 0 && (
          <div className="mcp-elicitation-fields">
            {request.fields.map((field) => (
              <ElicitationField
                key={field.id}
                field={field}
                value={values[field.id]}
                onChange={(value) =>
                  setValues((current) => ({ ...current, [field.id]: value }))
                }
              />
            ))}
          </div>
        )}

        {request.mode === "url" && request.url && (
          <div className="mcp-elicitation-url">
            <code>{request.url}</code>
            <button type="button" onClick={() => void openTarget()}>
              <ExternalLink /> {t("mcpElicitation.openChromium")}
            </button>
            {openError && (
              <div role="alert">
                <span>{t("mcpElicitation.openError")}</span>
                <small>{openError}</small>
                <button type="button" onClick={() => void openTarget(true)}>
                  {t("mcpElicitation.openSystem")}
                </button>
              </div>
            )}
          </div>
        )}

        {request.mode === "unsupported" && (
          <p className="mcp-elicitation-unsupported" role="alert">
            {t("mcpElicitation.unsupported")}
          </p>
        )}

        <div className="modal-actions mcp-elicitation-actions">
          <button
            type="button"
            disabled={submitting}
            onClick={() => onSubmit(mcpElicitationResponse("cancel"))}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onSubmit(mcpElicitationResponse("decline"))}
          >
            {t("mcpElicitation.decline")}
          </button>
          {approvalOnly &&
            request.persistModes.map((mode) => (
              <button
                type="button"
                disabled={submitting}
                key={mode}
                onClick={() =>
                  onSubmit(mcpElicitationResponse("accept", {}, mode))
                }
              >
                {mode === "session"
                  ? t("mcpElicitation.allowSession")
                  : t("mcpElicitation.allowAlways")}
              </button>
            ))}
          {request.mode !== "unsupported" && (
            <button className="primary" disabled={submitting} type="submit">
              {submitting
                ? t("mcpElicitation.sending")
                : approvalOnly
                  ? t("mcpElicitation.allowOnce")
                  : request.mode === "url"
                    ? t("mcpElicitation.done")
                    : t("mcpElicitation.submit")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

type FieldValue = string | number | boolean | string[] | undefined;

function ElicitationField({
  field,
  value,
  onChange,
}: {
  field: McpElicitationField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}) {
  const { t } = useI18n();
  const describedBy = field.description ? `${field.id}-description` : undefined;
  if (field.kind === "boolean") {
    return (
      <label className="mcp-elicitation-checkbox">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
        <FieldLabel field={field} />
      </label>
    );
  }
  if (field.kind === "multi-select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset>
        <legend>
          {field.title} {field.required && <span aria-hidden="true">*</span>}
        </legend>
        {field.description && <small>{field.description}</small>}
        <div className="mcp-elicitation-options">
          {field.options.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, option.value]
                      : selected.filter((item) => item !== option.value),
                  )
                }
              />
              {option.label}
            </label>
          ))}
        </div>
        <input
          className="mcp-elicitation-selection-validator"
          tabIndex={-1}
          aria-hidden="true"
          required={field.required || (field.minItems ?? 0) > 0}
          minLength={field.minItems}
          maxLength={field.maxItems}
          value={"x".repeat(selected.length)}
          onChange={() => undefined}
        />
      </fieldset>
    );
  }
  return (
    <label>
      <FieldLabel field={field} />
      {field.kind === "select" ? (
        <select
          required={field.required}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={describedBy}
        >
          {!field.required && <option value="">{t("mcpElicitation.optional")}</option>}
          {field.required && !value && <option value="" />}
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          required={field.required}
          type={inputType(field)}
          step={field.kind === "number" && field.integer ? 1 : undefined}
          min={field.kind === "number" ? field.minimum : undefined}
          max={field.kind === "number" ? field.maximum : undefined}
          minLength={field.kind === "text" ? field.minLength : undefined}
          maxLength={field.kind === "text" ? field.maxLength : undefined}
          value={typeof value === "number" || typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={describedBy}
        />
      )}
    </label>
  );
}

function FieldLabel({ field }: { field: McpElicitationField }) {
  return (
    <span>
      <strong>
        {field.title} {field.required && <span aria-hidden="true">*</span>}
      </strong>
      {field.description && <small id={`${field.id}-description`}>{field.description}</small>}
    </span>
  );
}

function initialValues(fields: McpElicitationField[]) {
  return Object.fromEntries(
    fields.map((field) => [field.id, field.defaultValue]),
  ) as Record<string, FieldValue>;
}

function responseContent(
  request: McpElicitationRequest,
  values: Record<string, FieldValue>,
) {
  return Object.fromEntries(
    request.fields.flatMap((field) => {
      const value = values[field.id];
      if (field.kind === "number") {
        if (value === "" || value === undefined) return [];
        return [[field.id, Number(value)]];
      }
      if (field.kind === "text" || field.kind === "select") {
        return value === "" || value === undefined ? [] : [[field.id, value]];
      }
      return [[field.id, value]];
    }),
  );
}

function inputType(field: McpElicitationField) {
  if (field.kind === "number") return "number";
  if (field.kind !== "text") return "text";
  if (field.format === "email") return "email";
  if (field.format === "uri") return "url";
  if (field.format === "date") return "date";
  if (field.format === "date-time") return "datetime-local";
  return "text";
}
