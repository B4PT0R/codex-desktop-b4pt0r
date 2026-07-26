import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { openFileReference } from "./file-reference.mjs";

test("opens a workspace file with the configured editor and position", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-file-reference-"));
  try {
    const file = path.join(root, "src", "app.ts");
    await mkdir(path.dirname(file));
    await writeFile(file, "export {};\n");
    let opened;
    const result = await openFileReference(
      {
        path: "src/app.ts",
        workspace: root,
        opener: "vscode",
        line: 12,
        column: 3,
      },
      {
        openExternal: async (url) => {
          opened = url;
        },
      },
      {},
      root,
    );
    assert.equal(opened, `vscode://file${file}:12:3`);
    assert.deepEqual(result, {
      path: file,
      opener: "vscode",
      type: "file",
      encoding: "utf-8",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("opens an explicit absolute file outside the workspace", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-file-reference-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "codex-file-outside-"));
  try {
    const file = path.join(outside, "shared.txt");
    await writeFile(file, "shared\n");
    let opened;
    const result = await openFileReference(
      { path: file, opener: "none" },
      {
        openPath: async (target) => {
          opened = target;
          return "";
        },
      },
    );
    assert.equal(opened, file);
    assert.deepEqual(result, {
      path: file,
      opener: "system",
      type: "file",
      encoding: "utf-8",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("delegates a non-UTF-8 file to the operating system", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-encoded-reference-"));
  try {
    const file = path.join(root, "latin1.txt");
    await writeFile(file, Buffer.from([0x63, 0x61, 0x66, 0xe9]));
    let opened;
    const result = await openFileReference(
      { path: file, opener: "vscode" },
      {
        openExternal: async () => {
          assert.fail("the configured text editor must not be forced");
        },
        openPath: async (target) => {
          opened = target;
          return "";
        },
      },
    );
    assert.equal(opened, file);
    assert.deepEqual(result, {
      path: file,
      opener: "system",
      type: "file",
      encoding: "other",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("opens a directory in the operating system file explorer", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-directory-reference-"));
  try {
    let opened;
    const result = await openFileReference(
      { path: root, opener: "vscode" },
      {
        openPath: async (target) => {
          opened = target;
          return "";
        },
      },
    );
    assert.equal(opened, root);
    assert.deepEqual(result, {
      path: root,
      opener: "system",
      type: "directory",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
