import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import {
  chmod,
  mkdir,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const HOST = "127.0.0.1";

export class BrowserArtifactServer {
  #directory;
  #server;

  constructor(directory) {
    this.#directory = directory;
  }

  async pageForImage(dataUrl) {
    validateImage(dataUrl);
    await privateDirectory(this.#directory);
    const file = path.join(
      this.#directory,
      `generated-${process.pid}-${Date.now()}.html`,
    );
    const escaped = dataUrl.replaceAll("'", "&#39;");
    await writeFile(
      file,
      `<!doctype html><meta charset=utf-8><meta http-equiv=Content-Security-Policy content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>html,body{height:100%;margin:0;background:#181817}body{display:grid;place-items:center}img{max-width:100%;max-height:100%;object-fit:contain}</style><img alt="Codex generated image" src="${escaped}">`,
      { mode: 0o600, flag: "wx" },
    );
    await pruneArtifacts(this.#directory);
    await this.#start();
    const address = this.#server.address();
    return `http://${HOST}:${address.port}/${encodeURIComponent(path.basename(file))}`;
  }

  async stop() {
    if (!this.#server) return;
    await new Promise((resolve) => this.#server.close(resolve));
    this.#server = undefined;
  }

  async #start() {
    if (this.#server) return;
    this.#server = createServer(async (request, response) => {
      try {
        const name = decodeURIComponent(
          new URL(request.url ?? "/", "http://localhost").pathname.slice(1),
        );
        const target = path.join(this.#directory, name);
        if (
          !name ||
          path.dirname(target) !== this.#directory ||
          !(await stat(target)).isFile()
        ) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        createReadStream(target).pipe(response);
      } catch {
        response.writeHead(404).end();
      }
    });
    await new Promise((resolve, reject) => {
      this.#server.once("error", reject);
      this.#server.listen(0, HOST, resolve);
    });
  }
}

function validateImage(dataUrl) {
  if (
    typeof dataUrl !== "string" ||
    dataUrl.length > 20_000_000 ||
    !/^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(
      dataUrl,
    )
  ) {
    throw new Error("Generated image data is invalid");
  }
}

async function privateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
}

async function pruneArtifacts(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
      .map(async (entry) => ({
        path: path.join(directory, entry.name),
        modified: (await stat(path.join(directory, entry.name))).mtimeMs,
      })),
  );
  files.sort((a, b) => b.modified - a.modified);
  await Promise.all(files.slice(20).map((file) => unlink(file.path).catch(() => {})));
}
