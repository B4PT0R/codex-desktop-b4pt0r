import {
  environmentForCodex,
  findCodexExecutable,
} from "./app-server.mjs";

const MAX_OUTPUT = 8_000;
const SERVER_NAME = "playwright";

export async function ensurePlaywrightCodexConfig({
  endpoint,
  environment,
  spawnProcess,
}) {
  const executable = await findCodexExecutable(environment);
  const codexEnvironment = environmentForCodex(executable, environment);
  const current = await runCodex(
    executable,
    ["mcp", "get", SERVER_NAME, "--json"],
    codexEnvironment,
    spawnProcess,
    true,
  );
  if (isExpectedPlaywrightConfig(current, endpoint)) return false;
  await runCodex(
    executable,
    ["mcp", "remove", SERVER_NAME],
    codexEnvironment,
    spawnProcess,
    true,
  );
  await runCodex(
    executable,
    ["mcp", "add", SERVER_NAME, "--url", endpoint],
    codexEnvironment,
    spawnProcess,
  );
  return true;
}

export async function removePlaywrightCodexConfig({
  endpoint,
  environment,
  spawnProcess,
}) {
  const executable = await findCodexExecutable(environment);
  const codexEnvironment = environmentForCodex(executable, environment);
  const current = await runCodex(
    executable,
    ["mcp", "get", SERVER_NAME, "--json"],
    codexEnvironment,
    spawnProcess,
    true,
  );
  if (!isExpectedPlaywrightConfig(current, endpoint)) return false;
  await runCodex(
    executable,
    ["mcp", "remove", SERVER_NAME],
    codexEnvironment,
    spawnProcess,
  );
  return true;
}

export function isExpectedPlaywrightConfig(output, endpoint) {
  try {
    const config = JSON.parse(output);
    return (
      config?.enabled === true &&
      config?.transport?.type === "streamable_http" &&
      config.transport.url === endpoint
    );
  } catch {
    return false;
  }
}

async function runCodex(
  executable,
  args,
  environment,
  spawnProcess,
  tolerateFailure = false,
) {
  const child = spawnProcess(executable, args, {
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  let stdout = "";
  child.stdout?.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-MAX_OUTPUT);
  });
  child.stderr?.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-MAX_OUTPUT);
  });
  try {
    await childExit(child, `codex ${args.slice(0, 3).join(" ")}`);
    return stdout;
  } catch (error) {
    if (!tolerateFailure) throw new Error(stderr.trim() || error.message);
    return "";
  }
}

function childExit(child, label) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with ${code ?? signal}`));
    });
  });
}
