import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { sha256File } from "../src/utils/hash";

export async function createTempRepo(prefix = "lumaforge-profiles-test-") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await fs.mkdir(path.join(root, "profiles"), { recursive: true });
  return root;
}

export async function writeFixture(root: string, relativePath: string, content: string) {
  const fullPath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content);
  return fullPath;
}

export async function readJson<T>(root: string, relativePath: string): Promise<T> {
  const raw = await fs.readFile(path.join(root, relativePath), "utf8");
  return JSON.parse(raw) as T;
}

export function posixPath(value: string) {
  return value.split(path.sep).join("/");
}

export interface WriteProfileEntryOptions {
  id: string;
  entryDir: string;
  kind?: string;
  format?: string;
  role?: string;
  mediaType?: string;
  assetFileName?: string;
  assetContent?: string;
  version?: string;
  title?: string;
  license?: string;
  author?: string;
  source?: string;
  sourceUrl?: string | null;
  redistributionAllowed?: boolean;
}

const roleByFormat: Record<string, string> = {
  cube: "cube-lut",
  dcp: "dcp",
  lcp: "lcp"
};

const mediaTypeByFormat: Record<string, string> = {
  cube: "application/x-cube-lut",
  dcp: "application/x-adobe-dng-camera-profile",
  lcp: "application/x-adobe-lens-correction-profile"
};

export async function writeProfileEntry(root: string, options: WriteProfileEntryOptions) {
  const format = options.format ?? "cube";
  const assetFileName = options.assetFileName ?? `${options.id.split(".").pop()}.${format}`;
  const assetPath = await writeFixture(
    root,
    `${options.entryDir}/assets/${assetFileName}`,
    options.assetContent ?? (format === "cube" ? "TITLE \"safe\"\n" : `fake ${format}\n`)
  );
  const byteSize = (await fs.stat(assetPath)).size;
  const sha256 = await sha256File(assetPath);
  const manifest = {
    schemaVersion: 1,
    id: options.id,
    kind: options.kind ?? "lut",
    format,
    version: options.version ?? "1.0.0",
    title: options.title ?? options.id,
    description: null,
    license: options.license ?? "CC0-1.0",
    author: options.author ?? "LumaForge contributors",
    source: options.source ?? "original",
    sourceUrl: options.sourceUrl ?? null,
    redistributionAllowed: options.redistributionAllowed ?? true,
    targets: {},
    assets: [
      {
        role: options.role ?? roleByFormat[format] ?? "metadata",
        path: `assets/${assetFileName}`,
        mediaType: options.mediaType ?? mediaTypeByFormat[format] ?? "application/octet-stream",
        byteSize,
        sha256
      }
    ],
    createdAt: "2026-04-28T00:00:00.000Z",
    updatedAt: "2026-04-28T00:00:00.000Z"
  };
  await writeFixture(root, `${options.entryDir}/manifest.json`, JSON.stringify(manifest, null, 2));
  return { assetPath, byteSize, sha256, manifest };
}
