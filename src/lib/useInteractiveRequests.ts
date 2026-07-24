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

/** Owns interactive requests and safe client-provided responses from App Server. */
export function useInteractiveRequests({ onError }: InteractiveRequestOptions) {
  const { t } = useI18n();
  const [approval, setApproval] = useState<Approval>();
  const [userInput, setUserInput] = useState<UserInputRequest>();
  const [submittingUserInput, setSubmittingUserInput] = useState(false);
  const [mcpElicitation, setMcpElicitation] = useState<McpElicitationRequest>();
  const [submittingMcpElicitation, setSubmittingMcpElicitation] = useState(false);
  const mcpRequestVersion = useRef(0);
  const approvalInFlight = useRef(false);
  const userInputInFlight = useRef(false);
  const mcpElicitationInFlight = useRef(false);

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
      if (!approval || approvalInFlight.current) return;
      approvalInFlight.current = true;
      try {
        await respond(approval.requestId, approvalResponse(approval, decision));
        setApproval(undefined);
      } catch (error) {
        onError(t("approval.error"), error);
      } finally {
        approvalInFlight.current = false;
      }
    },
    [approval, onError, t],
  );

  const answerUserInput = useCallback(
    async (response: UserInputResponse) => {
      if (!userInput || userInputInFlight.current) return;
      userInputInFlight.current = true;
      setSubmittingUserInput(true);
      try {
        await respond(userInput.requestId, response);
        setUserInput(undefined);
      } catch (error) {
        onError(t("userInput.error"), error);
      } finally {
        userInputInFlight.current = false;
        setSubmittingUserInput(false);
      }
    },
    [onError, t, userInput],
  );

  const answerMcpElicitation = useCallback(
    async (response: McpElicitationResponse) => {
      if (!mcpElicitation || mcpElicitationInFlight.current) return;
      mcpElicitationInFlight.current = true;
      setSubmittingMcpElicitation(true);
      try {
        await respond(mcpElicitation.requestId, response);
        setMcpElicitation(undefined);
      } catch (error) {
        onError(t("mcpElicitation.error"), error);
      } finally {
        mcpElicitationInFlight.current = false;
        setSubmittingMcpElicitation(false);
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
    submittingMcpElicitation,
    submittingUserInput,
    userInput,
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
