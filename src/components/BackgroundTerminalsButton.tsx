import { RefreshCw, Square, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import {
  useBackgroundTerminals,
  type BackgroundTerminal,
} from "../lib/useBackgroundTerminals";
import { RoundIconButton } from "./RoundIcon";

type BackgroundTerminalsButtonProps = {
  busy: boolean;
  connected: boolean;
  threadId?: string;
};

export function BackgroundTerminalsButton({
  busy,
  connected,
  threadId,
}: BackgroundTerminalsButtonProps) {
  const { t } = useI18n();
  const controller = useBackgroundTerminals({ busy, connected, threadId });
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<string>();
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
    setConfirming(undefined);
  }, [threadId]);
  useEffect(() => {
    if (controller.terminals.length === 0) setOpen(false);
  }, [controller.terminals.length]);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      opener.current?.focus();
    };
  }, [open]);

  if (controller.terminals.length === 0) return null;
  return (
    <div className="background-terminals" ref={root}>
      <RoundIconButton
        ref={opener}
        className="background-terminals-trigger"
        aria-expanded={open}
        aria-label={t("backgroundTerminals.count", {
          count: controller.terminals.length,
        })}
        title={t("backgroundTerminals.count", {
          count: controller.terminals.length,
        })}
        icon={Terminal}
        label={controller.terminals.length}
        onClick={() => setOpen((value) => !value)}
        variant="tertiary"
      />
      {open && (
        <div
          ref={panel}
          className="background-terminals-popover"
          role="dialog"
          aria-label={t("backgroundTerminals.title")}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
            }
          }}
        >
          <header>
            <span>
              <strong>{t("backgroundTerminals.title")}</strong>
              <small>{t("backgroundTerminals.detail")}</small>
            </span>
            <RoundIconButton
              aria-label={t("backgroundTerminals.refresh")}
              disabled={controller.loading}
              icon={RefreshCw}
              iconClassName={controller.loading ? "spin" : ""}
              onClick={() => void controller.refresh()}
              variant="tertiary"
            />
          </header>
          <div className="background-terminal-list">
            {controller.terminals.map((terminal) => (
              <TerminalRow
                key={terminal.processId}
                terminal={terminal}
                confirming={confirming === terminal.processId}
                terminating={controller.terminating.includes(terminal.processId)}
                onCancel={() => setConfirming(undefined)}
                onConfirm={() => {
                  void controller.terminate(terminal.processId).then((stopped) => {
                    if (stopped) setConfirming(undefined);
                  });
                }}
                onRequestStop={() => setConfirming(terminal.processId)}
              />
            ))}
          </div>
          {controller.error && (
            <p className="background-terminals-error" role="alert">
              {t("backgroundTerminals.error")} <small>{controller.error}</small>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TerminalRow({
  terminal,
  confirming,
  terminating,
  onCancel,
  onConfirm,
  onRequestStop,
}: {
  terminal: BackgroundTerminal;
  confirming: boolean;
  terminating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onRequestStop: () => void;
}) {
  const { t } = useI18n();
  return (
    <article className="background-terminal-row">
      <div>
        <code title={terminal.command}>{terminal.command}</code>
        <small title={terminal.cwd}>{terminal.cwd}</small>
        <span>
          {terminal.osPid !== undefined && `PID ${terminal.osPid}`}
          {terminal.cpuPercent !== undefined &&
            ` · ${terminal.cpuPercent.toFixed(1)} % CPU`}
          {terminal.rssKb !== undefined &&
            ` · ${formatMemory(terminal.rssKb)} ${t("backgroundTerminals.memory")}`}
        </span>
      </div>
      {confirming ? (
        <div className="background-terminal-confirm">
          <small>{t("backgroundTerminals.confirm")}</small>
          <span>
            <button disabled={terminating} onClick={onCancel}>
              {t("common.cancel")}
            </button>
            <button className="danger" disabled={terminating} onClick={onConfirm}>
              {terminating
                ? t("backgroundTerminals.stopping")
                : t("backgroundTerminals.stop")}
            </button>
          </span>
        </div>
      ) : (
        <RoundIconButton
          className="background-terminal-stop"
          aria-label={t("backgroundTerminals.stopCommand", {
            command: terminal.command,
          })}
          icon={Square}
          onClick={onRequestStop}
          variant="tertiary"
        />
      )}
    </article>
  );
}

function formatMemory(rssKb: number) {
  return rssKb >= 1_024
    ? `${(rssKb / 1_024).toFixed(rssKb >= 10_240 ? 0 : 1)} MB`
    : `${rssKb} KB`;
}
