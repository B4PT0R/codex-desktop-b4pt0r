import path from "node:path";
import { mkdir } from "node:fs/promises";

export async function createDiscussionWorkspace(documents, title, now = new Date()) {
  if (typeof documents !== "string" || !path.isAbsolute(documents)) {
    throw new Error("Invalid Documents directory");
  }
  const root = path.join(documents, "Codex");
  await mkdir(root, { recursive: true, mode: 0o755 });
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const slug = discussionSlug(title);
  for (let index = 0; index < 100; index += 1) {
    const suffix = index ? `-${index + 1}` : "";
    const directory = path.join(root, `${date}-${slug}${suffix}`);
    try {
      await mkdir(directory, { mode: 0o755 });
      return directory;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
  throw new Error("Unable to allocate a discussion directory");
}

export function discussionSlug(value) {
  const normalized = typeof value === "string"
    ? value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    : "";
  return normalized
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "") || "discussion";
}
