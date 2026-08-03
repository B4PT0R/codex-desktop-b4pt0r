import { useEffect, useRef, useState } from "react";
import {
  approvalCommandChoices,
  autoReviewCommandChoices,
  modelCommandChoices,
  permissionCommandChoices,
  reasoningCommandChoices,
} from "../components/composerCommandChoices";
import type { Translate } from "../i18n/translate";
import type { ChatMessage, Model } from "../types";
import type { PermissionProfileSummary } from "./appServerTypes";
import type { BackgroundTerminalsController } from "./useBackgroundTerminals";
import type {
  ComposerCommand,
  ComposerCommandChoiceRequest,
  HeaderCommandRequest,
} from "./commands";
import type { ApprovalPolicy, Permission } from "./protocol";
import { reasoningEffortLabel } from "./reasoningEffort";
import { useAutoReviewDenials } from "./useAutoReviewDenials";

type RuntimeMutations = {
  changeApprovalPolicy: (policy: ApprovalPolicy) => Promise<boolean>;
  changeCollaborationMode: (mode: "plan") => Promise<boolean>;
  changePermission: (permission: Permission) => Promise<boolean>;
  changeServiceTier: (tier: string | null) => Promise<boolean>;
};

type ComposerCommandOptions = {
  allowedApprovalPolicies?: ApprovalPolicy[];
  approvalPolicy: ApprovalPolicy;
  backgroundTerminals: BackgroundTerminalsController;
  busy: boolean;
  connected: boolean;
  effort: string;
  messages: ChatMessage[];
  model: string;
  models: Model[];
  permission: Permission;
  permissionProfiles: PermissionProfileSummary[];
  runtimeMutations: RuntimeMutations;
  serviceTier: string | null;
  threadId?: string;
  translate: Translate;
  onAppendResult: (title: string, content: string) => void;
  onClear: () => void;
  onCompact: () => Promise<boolean>;
  onReview: () => Promise<boolean>;
  onSetEffort: (effort: string) => void;
  onSetModel: (model: string) => void;
  onShowError: (title: string, error: unknown) => void;
  writeClipboard?: (text: string) => Promise<void>;
};

export function useComposerCommands(options: ComposerCommandOptions) {
  const {
    allowedApprovalPolicies,
    approvalPolicy,
    backgroundTerminals,
    busy,
    connected,
    effort,
    messages,
    model,
    models,
    permission,
    permissionProfiles,
    runtimeMutations,
    serviceTier,
    threadId,
    translate: t,
    onAppendResult,
    onClear,
    onCompact,
    onReview,
    onSetEffort,
    onSetModel,
    onShowError,
    writeClipboard = writeClipboardText,
  } = options;
  const [choiceRequest, setChoiceRequest] =
    useState<ComposerCommandChoiceRequest>();
  const [headerRequest, setHeaderRequest] = useState<HeaderCommandRequest>();
  const choiceSequence = useRef(0);
  const pendingChoice = useRef<number | undefined>(undefined);
  const headerSequence = useRef(0);
  const activeThread = useRef(threadId);
  activeThread.current = threadId;
  const autoReviewDenials = useAutoReviewDenials();

  useEffect(() => setChoiceRequest(undefined), [threadId]);

  function openChoices(command: ComposerCommandChoiceRequest["command"]) {
    const id = ++choiceSequence.current;
    if (command === "/model") {
      setChoiceRequest({
        id,
        command,
        stage: "model",
        choices: modelCommandChoices(models, model),
      });
      return;
    }
    if (command === "/reasoning") {
      setChoiceRequest({
        id,
        command,
        stage: "effort",
        choices: reasoningCommandChoices(models, model, effort, t),
      });
      return;
    }
    if (command === "/permissions") {
      setChoiceRequest({
        id,
        command,
        stage: "permission",
        choices: permissionCommandChoices(permissionProfiles, permission, t),
      });
      return;
    }
    if (command === "/approvals") {
      setChoiceRequest({
        id,
        command,
        stage: "approval",
        choices: approvalCommandChoices(
          allowedApprovalPolicies,
          approvalPolicy,
          t,
        ),
      });
      return;
    }
    const denials = autoReviewDenials.forThread(threadId);
    if (denials.length === 0) {
      onAppendResult(command, t("composer.approve.empty"));
      return;
    }
    setChoiceRequest({
      id,
      command,
      stage: "autoReview",
      choices: autoReviewCommandChoices(denials, t),
    });
  }

  async function selectChoice(choiceId: string) {
    const current = choiceRequest;
    if (!current || pendingChoice.current === current.id) return;
    pendingChoice.current = current.id;
    try {
      await applyChoice(current, choiceId);
    } finally {
      if (pendingChoice.current === current.id) {
        pendingChoice.current = undefined;
      }
    }
  }

  async function applyChoice(
    current: ComposerCommandChoiceRequest,
    choiceId: string,
  ) {
    const targetThread = threadId;
    const selectedLabel =
      current.choices.find((choice) => choice.id === choiceId)?.label ?? choiceId;
    if (current.stage === "model") {
      const selected = models.find((candidate) => candidate.id === choiceId);
      onSetModel(choiceId);
      const supportsCurrentEffort = selected?.supportedReasoningEfforts?.some(
        (option) => option.reasoningEffort === effort,
      );
      if (!supportsCurrentEffort) {
        onSetEffort(
          selected?.defaultReasoningEffort ??
            selected?.supportedReasoningEfforts?.[0]?.reasoningEffort ??
            effort,
        );
      }
      if (
        serviceTier &&
        !selected?.serviceTiers?.some((tier) => tier.id === serviceTier)
      ) {
        await runtimeMutations.changeServiceTier(null);
      }
      if (activeThread.current === targetThread) {
        setChoiceRequest(undefined);
        onAppendResult(
          current.command,
          t("composer.command.selection", { value: selectedLabel }),
        );
      }
      return;
    }
    if (current.stage === "effort") {
      onSetEffort(choiceId);
      setChoiceRequest(undefined);
      onAppendResult(
        current.command,
        t("composer.command.selection", { value: selectedLabel }),
      );
      return;
    }
    if (current.stage === "permission") {
      const saved = await runtimeMutations.changePermission(choiceId);
      if (saved && activeThread.current === targetThread) {
        setChoiceRequest(undefined);
        onAppendResult(
          current.command,
          t("composer.command.selection", { value: selectedLabel }),
        );
      }
      return;
    }
    if (current.stage === "approval") {
      const saved = await runtimeMutations.changeApprovalPolicy(
        choiceId as ApprovalPolicy,
      );
      if (saved && activeThread.current === targetThread) {
        setChoiceRequest(undefined);
        onAppendResult(
          current.command,
          t("composer.command.selection", { value: selectedLabel }),
        );
      }
      return;
    }
    if (!targetThread) return;
    try {
      const approved = await autoReviewDenials.approve(targetThread, choiceId);
      if (!approved || activeThread.current !== targetThread) return;
      setChoiceRequest(undefined);
      onAppendResult(current.command, t("composer.approve.recorded"));
    } catch (error) {
      if (activeThread.current === targetThread)
        onShowError(t("composer.approve.error"), error);
    }
  }

  async function execute(command: ComposerCommand) {
    const targetThread = threadId;
    if (command.requiresThread && !targetThread) {
      onAppendResult(command.value, t("composer.commands.requiresThread"));
      return;
    }
    if (busy && !command.availableDuringTask) {
      onAppendResult(command.value, t("composer.commands.requiresIdle"));
      return;
    }
    if (isChoiceCommand(command)) {
      openChoices(command.value);
      return;
    }
    switch (command.id) {
      case "fast":
        await toggleFast(command.value, targetThread);
        return;
      case "clear":
        onClear();
        onAppendResult(command.value, t("composer.clear.done"));
        return;
      case "plan": {
        const saved = await runtimeMutations.changeCollaborationMode("plan");
        if (saved && activeThread.current === targetThread)
          onAppendResult(command.value, t("composer.plan.done"));
        return;
      }
      case "compact": {
        const started = await onCompact();
        if (started && activeThread.current === targetThread)
          onAppendResult(command.value, t("composer.compact.started"));
        return;
      }
      case "init":
      case "goal":
        setHeaderRequest({
          id: ++headerSequence.current,
          target: command.id === "init" ? "agents" : "goal",
        });
        onAppendResult(
          command.value,
          t(
            command.id === "init"
              ? "composer.init.opened"
              : "composer.goal.opened",
          ),
        );
        return;
      case "copy":
        await copyLastResponse(command.value, targetThread);
        return;
      case "status":
        onAppendResult(command.value, statusMarkdown());
        return;
      case "ps":
        await listBackgroundJobs(command.value, targetThread);
        return;
      case "stop":
        await stopBackgroundJobs(command.value, targetThread);
        return;
      case "review": {
        const started = await onReview();
        if (started && activeThread.current === targetThread)
          onAppendResult(command.value, t("composer.review.started"));
        return;
      }
    }
  }

  async function toggleFast(title: string, targetThread?: string) {
    const selected = models.find((candidate) => candidate.id === model);
    const fastTier = selected?.serviceTiers?.find((tier) => tier.id === "fast");
    if (!fastTier) {
      onAppendResult(title, t("composer.fast.unavailable"));
      return;
    }
    const disabling = serviceTier === fastTier.id;
    const saved = await runtimeMutations.changeServiceTier(
      disabling ? null : fastTier.id,
    );
    if (saved && activeThread.current === targetThread) {
      onAppendResult(
        title,
        t(disabling ? "composer.fast.disabled" : "composer.fast.enabled"),
      );
    }
  }

  async function copyLastResponse(title: string, targetThread?: string) {
    const lastResponse = [...messages].reverse().find(isCopyableResponse);
    if (!lastResponse) {
      onAppendResult(title, t("composer.copy.empty"));
      return;
    }
    try {
      await writeClipboard(lastResponse.content);
      if (activeThread.current === targetThread)
        onAppendResult(title, t("composer.copy.done"));
    } catch (error) {
      if (activeThread.current === targetThread)
        onShowError(t("composer.copy.error"), error);
    }
  }

  function statusMarkdown() {
    return `- **${t("app.session.connection")}**: ${connected ? t("app.session.active") : t("app.session.inactive")}\n- **${t("app.session.model")}**: ${model}\n- **${t("app.session.reasoning")}**: ${reasoningEffortLabel(effort, t)}\n- **${t("app.session.permissions")}**: ${permission}\n- **${t("app.session.approvals")}**: ${t(`approvalPolicy.${approvalPolicy}`)}\n- **${t("app.session.thread")}**: ${threadId ?? t("app.session.new")}`;
  }

  async function listBackgroundJobs(title: string, targetThread?: string) {
    const terminals = await backgroundTerminals.refresh();
    if (activeThread.current !== targetThread) return;
    onAppendResult(
      title,
      terminals.length === 0
        ? t("composer.ps.empty")
        : terminals
            .map(
              (terminal) =>
                `- \`${terminal.command.replaceAll("`", "\\`")}\` — ${terminal.cwd}`,
            )
            .join("\n"),
    );
  }

  async function stopBackgroundJobs(title: string, targetThread?: string) {
    const terminals = await backgroundTerminals.refresh();
    if (activeThread.current !== targetThread) return;
    if (terminals.length === 0) {
      onAppendResult(title, t("composer.stop.empty"));
      return;
    }
    const stopped = (
      await Promise.all(
        terminals.map((terminal) =>
          backgroundTerminals.terminate(terminal.processId),
        ),
      )
    ).filter(Boolean).length;
    if (activeThread.current === targetThread)
      onAppendResult(title, t("composer.stop.done", { count: stopped }));
  }

  return {
    choiceRequest,
    dismissChoices: () => setChoiceRequest(undefined),
    execute,
    headerRequest,
    selectChoice,
  };
}

function isChoiceCommand(command: ComposerCommand): command is ComposerCommand & {
  value: ComposerCommandChoiceRequest["command"];
} {
  return ["model", "reasoning", "permissions", "approvals", "approve"].includes(
    command.id,
  );
}

function isCopyableResponse(message: ChatMessage) {
  return (
    message.role === "assistant" &&
    !message.streaming &&
    !message.modality &&
    Boolean(message.content.trim())
  );
}

function writeClipboardText(text: string) {
  return navigator.clipboard.writeText(text);
}
