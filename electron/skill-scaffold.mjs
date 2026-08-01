import { lstat, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { writeFileAtomically } from "./atomic-write.mjs";

const MAX_SKILL_BYTES = 256_000;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function createSkillScaffold(home, input) {
  const name = input?.name;
  const description = input?.description;
  const instructions = input?.instructions;
  const scope = input?.scope;
  if (typeof name !== "string" || !SKILL_NAME.test(name) || name.length > 64) {
    throw new Error("Skill name must use lowercase letters, digits, and hyphens");
  }
  if (typeof description !== "string" || !description.trim() || description.length > 2_000) {
    throw new Error("A skill description is required");
  }
  if (typeof instructions !== "string" || !instructions.trim()) {
    throw new Error("Skill instructions are required");
  }
  const root = await skillRoot(home, scope, input?.workspace);
  const directory = path.join(root, name);
  const filePath = path.join(directory, "SKILL.md");
  const content = skillDocument(name, description.trim(), instructions.trim());
  if (Buffer.byteLength(content, "utf8") > MAX_SKILL_BYTES) {
    throw new Error("SKILL.md exceeds the 256 KB limit");
  }
  await rejectExistingOrSymbolic(directory);
  await mkdir(directory, { recursive: false, mode: 0o755 });
  try {
    await writeFileAtomically(filePath, content, { mode: 0o644 });
  } catch (error) {
    throw error;
  }
  return { filePath, scope };
}

async function skillRoot(home, scope, workspace) {
  if (typeof home !== "string" || !path.isAbsolute(home)) throw new Error("Invalid home directory");
  if (scope === "user") {
    const root = path.join(path.resolve(home), ".codex", "skills");
    await mkdir(root, { recursive: true, mode: 0o755 });
    await validateRoot(root);
    return root;
  }
  if (scope !== "repo" || typeof workspace !== "string" || !path.isAbsolute(workspace)) {
    throw new Error("A valid workspace is required");
  }
  const resolved = path.resolve(workspace);
  if (!(await stat(resolved)).isDirectory()) throw new Error("Workspace is not a directory");
  const root = path.join(resolved, ".codex", "skills");
  await mkdir(root, { recursive: true, mode: 0o755 });
  await validateRoot(root);
  return root;
}

async function validateRoot(root) {
  const details = await lstat(root);
  if (details.isSymbolicLink() || !details.isDirectory()) {
    throw new Error("Skill root must be a real directory");
  }
}

async function rejectExistingOrSymbolic(directory) {
  try {
    const details = await lstat(directory);
    if (details.isSymbolicLink()) throw new Error("Symbolic skill directories are not supported");
    throw new Error("A skill with this name already exists");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function skillDocument(name, description, instructions) {
  return `---\nname: ${name}\ndescription: ${yamlString(description)}\n---\n\n${instructions}\n`;
}

function yamlString(value) {
  return JSON.stringify(value);
}
