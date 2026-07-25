import { copyFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_IMAGE_BYTES = 20_000_000;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const MIME_EXTENSIONS = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export async function generatedImageSaveOptions(args, picturesDirectory) {
  const source = await generatedImageSource(args);
  return {
    title: "Enregistrer l’image générée",
    defaultPath: path.join(
      picturesDirectory,
      source.name ?? `codex-image${source.extension}`,
    ),
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "gif"],
      },
    ],
  };
}

export async function saveGeneratedImage(args, destination) {
  if (typeof destination !== "string" || !path.isAbsolute(destination)) {
    throw new Error("Invalid generated image destination");
  }
  const source = await generatedImageSource(args);
  if (source.path) {
    if (path.resolve(source.path) !== path.resolve(destination)) {
      await copyFile(source.path, destination);
    }
    return destination;
  }
  await writeFile(destination, source.bytes, { mode: 0o600 });
  return destination;
}

async function generatedImageSource(args) {
  if (typeof args?.dataUrl === "string") {
    const match = args.dataUrl.match(
      /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/,
    );
    if (!match) throw new Error("Invalid generated image data");
    const bytes = Buffer.from(match[2].replaceAll(/\s/g, ""), "base64");
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
      throw new Error("Generated image data is too large");
    }
    return {
      bytes,
      extension: MIME_EXTENSIONS[match[1]],
    };
  }
  if (typeof args?.path !== "string" || !path.isAbsolute(args.path)) {
    throw new Error("Generated image is unavailable");
  }
  const extension = path.extname(args.path).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) {
    throw new Error("Unsupported generated image file");
  }
  const sourceStat = await stat(args.path);
  if (!sourceStat.isFile() || sourceStat.size > MAX_IMAGE_BYTES) {
    throw new Error("Generated image file is invalid");
  }
  return {
    extension,
    name: path.basename(args.path),
    path: args.path,
  };
}
