import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  generatedImageSaveOptions,
  saveGeneratedImage,
} from "./generated-image.mjs";

test("saves a bounded generated data URL", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-image-"));
  const destination = path.join(directory, "saved.png");
  const dataUrl = `data:image/png;base64,${Buffer.from("image").toString("base64")}`;

  const options = await generatedImageSaveOptions(
    { dataUrl },
    path.join(directory, "Pictures"),
  );
  assert.equal(options.defaultPath, path.join(directory, "Pictures", "codex-image.png"));

  await saveGeneratedImage({ dataUrl }, destination);
  assert.equal(await readFile(destination, "utf8"), "image");
});

test("copies only a supported bounded image file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-image-"));
  const source = path.join(directory, "source.webp");
  const destination = path.join(directory, "copy.webp");
  await writeFile(source, "image");

  const options = await generatedImageSaveOptions(
    { path: source },
    path.join(directory, "Pictures"),
  );
  assert.equal(options.defaultPath, path.join(directory, "Pictures", "source.webp"));

  await saveGeneratedImage({ path: source }, destination);
  assert.equal(await readFile(destination, "utf8"), "image");
  await assert.rejects(
    saveGeneratedImage({ path: path.join(directory, "notes.txt") }, destination),
    /Unsupported generated image file/,
  );
});
