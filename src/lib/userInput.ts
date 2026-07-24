import type { AppServerMessage } from "./codex";

export type UserInputOption = {
  description: string;
  label: string;
};

export type UserInputQuestion = {
  header: string;
  id: string;
  isOther: boolean;
  isSecret: boolean;
  options?: UserInputOption[];
  question: string;
};

export type UserInputRequest = {
  autoResolutionMs?: number;
  questions: UserInputQuestion[];
  requestId: number | string;
};

export type UserInputResponse = {
  answers: Record<string, { answers: string[] }>;
};

export function userInputFromMessage(
  message: AppServerMessage,
): UserInputRequest | undefined {
  if (message.id == null || message.method !== "item/tool/requestUserInput")
    return undefined;
  const params = record(message.params);
  if (!params || !Array.isArray(params.questions)) return undefined;
  const questions = params.questions.flatMap((value) => {
    const question = parseQuestion(value);
    return question ? [question] : [];
  });
  if (questions.length === 0) return undefined;
  return {
    requestId: message.id,
    questions,
    autoResolutionMs: nonNegativeNumber(params.autoResolutionMs),
  };
}

export function userInputResponse(
  answers: Record<string, string>,
): UserInputResponse {
  return {
    answers: Object.fromEntries(
      Object.entries(answers).map(([id, answer]) => [
        id,
        { answers: [answer] },
      ]),
    ),
  };
}

export function freeFormAnswer(answer: string) {
  return `user_note: ${answer.trim()}`;
}

function parseQuestion(value: unknown): UserInputQuestion | undefined {
  const question = record(value);
  const id = stringValue(question?.id);
  const header = stringValue(question?.header);
  const prompt = stringValue(question?.question);
  if (!id || !header || !prompt) return undefined;
  const options = Array.isArray(question?.options)
    ? question.options.flatMap((option) => {
        const parsed = parseOption(option);
        return parsed ? [parsed] : [];
      })
    : undefined;
  return {
    id,
    header,
    question: prompt,
    isOther: question?.isOther === true,
    isSecret: question?.isSecret === true,
    ...(options?.length ? { options } : {}),
  };
}

function parseOption(value: unknown): UserInputOption | undefined {
  const option = record(value);
  const label = stringValue(option?.label);
  const description = stringValue(option?.description);
  return label && description ? { label, description } : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}
