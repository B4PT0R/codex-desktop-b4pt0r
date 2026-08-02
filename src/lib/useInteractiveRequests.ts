import { useCallback, useRef, useState } from "react";
import type { Approval } from "../types";
import { approvalFromMessage, approvalResponse } from "./approval";
import { respond, type AppServerMessage } from "./codex";
import {
  userInputFromMessage,
  type UserInputRequest,
  type UserInputResponse,
} from "./userInput";
import { useI18n } from "../i18n/I18nProvider";
import type {
  McpElicitationRequest,
  McpElicitationResponse,
} from "./mcpElicitation";

type InteractiveRequestOptions = {
  onError: (title: string, error: unknown) => void;
};

type RequestId = number | string;

/** Owns interactive requests and safe client-provided responses from App Server. */
export function useInteractiveRequests({ onError }: InteractiveRequestOptions) {
  const { t } = useI18n();
  const [approval, setApproval] = useState<Approval>();
  const [userInput, setUserInput] = useState<UserInputRequest>();
  const [submittingUserInputId, setSubmittingUserInputId] =
    useState<RequestId>();
  const [mcpElicitation, setMcpElicitation] = useState<McpElicitationRequest>();
  const [submittingMcpElicitationId, setSubmittingMcpElicitationId] =
    useState<RequestId>();
  const mcpRequestVersion = useRef(0);
  const responsesInFlight = useRef(new Set<RequestId>());

  const handleMessage = useCallback(
    (message: AppServerMessage) => {
      const approvalRequest = approvalFromMessage(message, t);
      if (approvalRequest) {
        setApproval(approvalRequest);
        return true;
      }
      const userInputRequest = userInputFromMessage(message);
      if (userInputRequest) {
        setUserInput(userInputRequest);
        return true;
      }
      if (message.method === "mcpServer/elicitation/request") {
        const version = ++mcpRequestVersion.current;
        void import("./mcpElicitation")
          .then(({ mcpElicitationFromMessage }) => {
            const request = mcpElicitationFromMessage(message);
            if (request && version === mcpRequestVersion.current) {
              setMcpElicitation(request);
            }
          })
          .catch((error) => onError(t("mcpElicitation.error"), error));
        return true;
      }
      if (message.method === "currentTime/read" && message.id !== undefined) {
        void respond(message.id, {
          currentTimeAt: Math.floor(Date.now() / 1_000),
        }).catch((error) => onError(t("currentTime.error"), error));
        return true;
      }
      if (message.method === "serverRequest/resolved") {
        const requestId = record(message.params)?.requestId;
        setApproval((pending) =>
          pending?.requestId === requestId ? undefined : pending,
        );
        setUserInput((pending) =>
          pending?.requestId === requestId ? undefined : pending,
        );
        setMcpElicitation((pending) =>
          pending?.requestId === requestId ? undefined : pending,
        );
        mcpRequestVersion.current += 1;
      }
      return false;
    },
    [onError, t],
  );

  const decideApproval = useCallback(
    async (decision: "accept" | "session" | "decline") => {
      if (!approval || responsesInFlight.current.has(approval.requestId))
        return;
      const pending = approval;
      responsesInFlight.current.add(pending.requestId);
      try {
        await respond(pending.requestId, approvalResponse(pending, decision));
        setApproval((current) =>
          current?.requestId === pending.requestId ? undefined : current,
        );
      } catch (error) {
        onError(t("approval.error"), error);
      } finally {
        responsesInFlight.current.delete(pending.requestId);
      }
    },
    [approval, onError, t],
  );

  const answerUserInput = useCallback(
    async (response: UserInputResponse) => {
      if (!userInput || responsesInFlight.current.has(userInput.requestId))
        return;
      const pending = userInput;
      responsesInFlight.current.add(pending.requestId);
      setSubmittingUserInputId(pending.requestId);
      try {
        await respond(pending.requestId, response);
        setUserInput((current) =>
          current?.requestId === pending.requestId ? undefined : current,
        );
      } catch (error) {
        onError(t("userInput.error"), error);
      } finally {
        responsesInFlight.current.delete(pending.requestId);
        setSubmittingUserInputId((current) =>
          current === pending.requestId ? undefined : current,
        );
      }
    },
    [onError, t, userInput],
  );

  const answerMcpElicitation = useCallback(
    async (response: McpElicitationResponse) => {
      if (
        !mcpElicitation ||
        responsesInFlight.current.has(mcpElicitation.requestId)
      )
        return;
      const pending = mcpElicitation;
      responsesInFlight.current.add(pending.requestId);
      setSubmittingMcpElicitationId(pending.requestId);
      try {
        await respond(pending.requestId, response);
        setMcpElicitation((current) =>
          current?.requestId === pending.requestId ? undefined : current,
        );
      } catch (error) {
        onError(t("mcpElicitation.error"), error);
      } finally {
        responsesInFlight.current.delete(pending.requestId);
        setSubmittingMcpElicitationId((current) =>
          current === pending.requestId ? undefined : current,
        );
      }
    },
    [mcpElicitation, onError, t],
  );

  return {
    answerUserInput,
    answerMcpElicitation,
    approval,
    decideApproval,
    handleMessage,
    mcpElicitation,
    submittingMcpElicitation:
      submittingMcpElicitationId === mcpElicitation?.requestId,
    submittingUserInput: submittingUserInputId === userInput?.requestId,
    userInput,
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
