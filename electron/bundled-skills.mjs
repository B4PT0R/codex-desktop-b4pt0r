import path from "node:path";

export function bundledSkillsRoot({
  appRoot,
  packaged,
  resourcesPath,
}) {
  return packaged
    ? path.join(resourcesPath, "skills")
    : path.join(appRoot, "resources", "skills");
}
