import { useMemo, useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { useDialogFocus } from "../lib/useDialogFocus";
import { useI18n } from "../i18n/I18nProvider";
import { RoundIcon } from "./RoundIcon";
import { IconButton } from "./IconButton";
import {
  freeFormAnswer,
  userInputResponse,
  type UserInputRequest,
  type UserInputResponse,
} from "../lib/userInput";

const otherValue = "__codex_other__";

type UserInputDialogProps = {
  request: UserInputRequest;
  submitting: boolean;
  onSubmit: (response: UserInputResponse) => void;
};

export function UserInputDialog({
  request,
  submitting,
  onSubmit,
}: UserInputDialogProps) {
  const { t } = useI18n();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState<Record<string, string>>({});
  const { dialogRef, onDialogKeyDown } = useDialogFocus({
    initialFocusSelector: "input",
  });
  const complete = useMemo(
    () =>
      request.questions.every((question) => {
        const selection = selections[question.id];
        if (!question.options) return Boolean(freeText[question.id]?.trim());
        return (
          Boolean(selection) &&
          (selection !== otherValue || Boolean(freeText[question.id]?.trim()))
        );
      }),
    [freeText, request.questions, selections],
  );

  function submit() {
    if (!complete || submitting) return;
    const answers = Object.fromEntries(
      request.questions.map((question) => {
        const selection = selections[question.id];
        const answer =
          !question.options || selection === otherValue
            ? freeFormAnswer(freeText[question.id])
            : selection;
        return [question.id, answer];
      }),
    );
    onSubmit(userInputResponse(answers));
  }

  return (
    <div className="overlay">
      <div
        ref={dialogRef}
        className="modal user-input-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-input-title"
        onKeyDown={onDialogKeyDown}
        tabIndex={-1}
      >
        <RoundIcon
          className="approval-icon"
          icon={MessageCircleQuestion}
          size="large"
          variant="primary"
        />
        <h2 id="user-input-title">{t("userInput.title")}</h2>
        <div className="user-input-questions">
          {request.questions.map((question) => (
            <fieldset key={question.id}>
              <legend>{question.header}</legend>
              <p>{question.question}</p>
              {question.options ? (
                <div className="user-input-options">
                  {question.options.map((option) => (
                    <label key={option.label}>
                      <input
                        type="radio"
                        name={question.id}
                        value={option.label}
                        checked={selections[question.id] === option.label}
                        onChange={() =>
                          setSelections((items) => ({
                            ...items,
                            [question.id]: option.label,
                          }))
                        }
                      />
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                    </label>
                  ))}
                  {question.isOther && (
                    <label>
                      <input
                        type="radio"
                        name={question.id}
                        value={otherValue}
                        checked={selections[question.id] === otherValue}
                        onChange={() =>
                          setSelections((items) => ({
                            ...items,
                            [question.id]: otherValue,
                          }))
                        }
                      />
                      <span>
                        <strong>{t("userInput.other")}</strong>
                        <small>{t("userInput.freeForm")}</small>
                      </span>
                    </label>
                  )}
                </div>
              ) : null}
              {(!question.options ||
                selections[question.id] === otherValue) && (
                <input
                  className="user-input-freeform"
                  type={question.isSecret ? "password" : "text"}
                  aria-label={t("userInput.answerLabel", {
                    header: question.header,
                  })}
                  value={freeText[question.id] ?? ""}
                  onChange={(event) =>
                    setFreeText((items) => ({
                      ...items,
                      [question.id]: event.target.value,
                    }))
                  }
                />
              )}
            </fieldset>
          ))}
        </div>
        {!request.isBlocking && (
          <p className="hint">{t("userInput.autoResolution")}</p>
        )}
        <IconButton
          className="user-input-submit"
          disabled={!complete || submitting}
          icon={MessageCircleQuestion}
          label={submitting ? t("userInput.sending") : t("userInput.submit")}
          onClick={submit}
          variant="primary"
        />
      </div>
    </div>
  );
}
