import { useMemo } from "react";
import {
  Diff,
  Hunk,
  parseDiff,
  type FileData,
} from "react-diff-view/esm";
import "react-diff-view/style/index.css";
import { useI18n } from "../i18n/I18nProvider";

type PartialLine = {
  content: string;
  kind: "delete" | "hunk" | "insert" | "meta" | "normal";
  newLine?: number;
  oldLine?: number;
};

export default function DiffViewer({ diff }: { diff: string }) {
  const { t } = useI18n();
  const files = useMemo(() => structuredFiles(diff), [diff]);

  return (
    <div className="diff-viewer">
      {files ? (
        <div className="diff-files">
          {files.map((file, index) => (
            <StructuredFile
              file={file}
              key={`${file.oldPath}-${file.newPath}-${index}`}
            />
          ))}
        </div>
      ) : (
        <PartialDiff diff={diff} />
      )}
      <details className="diff-raw">
        <summary>{t("work.diff.raw")}</summary>
        <pre>{diff}</pre>
      </details>
    </div>
  );
}

function StructuredFile({ file }: { file: FileData }) {
  const { t } = useI18n();
  const path = file.newPath || file.oldPath || t("work.diff.unknownFile");
  const additions = file.hunks.reduce(
    (count, hunk) =>
      count + hunk.changes.filter((change) => change.type === "insert").length,
    0,
  );
  const deletions = file.hunks.reduce(
    (count, hunk) =>
      count + hunk.changes.filter((change) => change.type === "delete").length,
    0,
  );
  return (
    <section className="diff-file">
      <header className="diff-file-header">
        <span>
          <strong>{path}</strong>
          <small>{t(`work.diff.file.${file.type}`)}</small>
        </span>
        <span className="diff-file-stats" aria-label={t("work.diff.stats", {
          additions,
          deletions,
        })}>
          <b>+{additions}</b>
          <i>−{deletions}</i>
        </span>
      </header>
      {file.isBinary ? (
        <p className="diff-binary">{t("work.diff.binary")}</p>
      ) : (
        <Diff
          className="diff-table"
          diffType={file.type}
          hunks={file.hunks}
          viewType="unified"
        >
          {(hunks) =>
            hunks.map((hunk) => <Hunk hunk={hunk} key={hunk.content} />)
          }
        </Diff>
      )}
    </section>
  );
}

function PartialDiff({ diff }: { diff: string }) {
  const { t } = useI18n();
  const lines = useMemo(() => partialLines(diff), [diff]);
  return (
    <section className="diff-file partial">
      <header className="diff-file-header">
        <span>
          <strong>{t("work.diff.partial")}</strong>
          <small>{t("work.diff.partialDetail")}</small>
        </span>
      </header>
      <div className="partial-diff-scroll">
        <table aria-label={t("work.diff.partial")} className="partial-diff">
          <tbody>
            {lines.map((line, index) => (
              <tr className={line.kind} key={index}>
                <td className="line-number">{line.oldLine}</td>
                <td className="line-number">{line.newLine}</td>
                <td>
                  <code>{line.content || " "}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function structuredFiles(diff: string): FileData[] | undefined {
  try {
    const files = parseDiff(diff, { nearbySequences: "zip" });
    return files.length > 0 && files.some((file) => file.hunks.length > 0)
      ? files
      : undefined;
  } catch {
    return undefined;
  }
}

function partialLines(diff: string): PartialLine[] {
  let oldLine = 1;
  let newLine = 1;
  return diff.split("\n").map((content) => {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(content);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      return { content, kind: "hunk" };
    }
    if (
      content.startsWith("diff --git ") ||
      content.startsWith("index ") ||
      content.startsWith("--- ") ||
      content.startsWith("+++ ")
    ) {
      return { content, kind: "meta" };
    }
    if (content.startsWith("+")) {
      return { content, kind: "insert", newLine: newLine++ };
    }
    if (content.startsWith("-")) {
      return { content, kind: "delete", oldLine: oldLine++ };
    }
    return {
      content,
      kind: "normal",
      oldLine: oldLine++,
      newLine: newLine++,
    };
  });
}
