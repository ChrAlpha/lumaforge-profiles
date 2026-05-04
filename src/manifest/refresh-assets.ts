import path from "node:path";

import { discoverManifestPaths } from "./discover";
import type { ProfileKind } from "./types";
import {
  fileByteSize,
  fs,
  isSafeRelativePosixPath,
  readJsonFile,
  toPosixPath,
  writeJsonFile,
} from "../utils/fs";
import { sha256File } from "../utils/hash";
import { nowIso } from "../utils/time";

export interface RefreshProfileAssetMetadataOptions {
  rootDir: string;
  allowedKinds?: ProfileKind[];
  dryRun?: boolean;
  now?: string;
}

export interface RefreshedProfileAsset {
  manifestPath: string;
  assetPath: string;
  role: string | null;
  byteSizeBefore: unknown;
  byteSizeAfter: number;
  sha256Before: unknown;
  sha256After: string;
  changed: boolean;
}

export interface RefreshedProfileManifest {
  manifestPath: string;
  entryId: string | null;
  kind: string | null;
  changed: boolean;
  dryRun: boolean;
  assets: RefreshedProfileAsset[];
}

export interface RefreshProfileAssetMetadataResult {
  scanned: number;
  changed: number;
  dryRun: boolean;
  manifests: RefreshedProfileManifest[];
}

type MutableJsonObject = Record<string, unknown>;
type ManualManifest = MutableJsonObject & { assets: unknown[] };
type ManualAsset = MutableJsonObject & { path: string };

function isRecord(value: unknown): value is MutableJsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function manifestLabel(manifestPath: string, entryId: string | null) {
  return entryId ? `${entryId} ${manifestPath}` : manifestPath;
}

function assertManualManifest(
  value: unknown,
  manifestPath: string,
): ManualManifest {
  if (!isRecord(value)) {
    throw new Error(
      `[asset-refresh] ${manifestPath}: manifest must be a JSON object.`,
    );
  }
  if (!Array.isArray(value.assets)) {
    throw new Error(
      `[asset-refresh] ${manifestPath}: assets must be an array.`,
    );
  }
  return value as ManualManifest;
}

function assertManualAsset(
  value: unknown,
  manifestPath: string,
  index: number,
): ManualAsset {
  if (!isRecord(value)) {
    throw new Error(
      `[asset-refresh] ${manifestPath}: assets[${index}] must be an object.`,
    );
  }
  if (typeof value.path !== "string") {
    throw new Error(
      `[asset-refresh] ${manifestPath}: assets[${index}].path must be a string.`,
    );
  }
  if (!isSafeRelativePosixPath(value.path)) {
    throw new Error(
      `[asset-refresh] ${manifestPath}: assets[${index}].path escapes the entry directory.`,
    );
  }
  return value as ManualAsset;
}

export async function refreshProfileAssetMetadata(
  options: RefreshProfileAssetMetadataOptions,
): Promise<RefreshProfileAssetMetadataResult> {
  const manifestPaths = await discoverManifestPaths(options.rootDir);
  const allowedKinds = options.allowedKinds?.length
    ? new Set(options.allowedKinds)
    : null;
  const dryRun = options.dryRun ?? false;
  const timestamp = options.now ?? nowIso();
  const manifests: RefreshedProfileManifest[] = [];

  for (const manifestPath of manifestPaths) {
    const absoluteManifestPath = path.join(options.rootDir, manifestPath);
    const manifest = assertManualManifest(
      await readJsonFile<unknown>(absoluteManifestPath),
      manifestPath,
    );
    const entryId = stringField(manifest.id);
    const kind = stringField(manifest.kind);
    if (allowedKinds && !allowedKinds.has(kind as ProfileKind)) {
      throw new Error(
        `[kind-filter] ${manifestLabel(manifestPath, entryId)}: this registry is constrained to ${[
          ...allowedKinds,
        ].join(", ")} entries; found ${kind ?? "(missing)"}.`,
      );
    }

    const assets: RefreshedProfileAsset[] = [];
    let changed = false;

    for (const [index, rawAsset] of manifest.assets.entries()) {
      const asset = assertManualAsset(rawAsset, manifestPath, index);
      const normalizedAssetPath = path.posix.normalize(asset.path);
      const absoluteAssetPath = path.join(
        options.rootDir,
        path.posix.dirname(manifestPath),
        normalizedAssetPath,
      );
      if (!(await fs.pathExists(absoluteAssetPath))) {
        throw new Error(
          `[asset-refresh] ${manifestLabel(manifestPath, entryId)}: asset file does not exist: ${asset.path}`,
        );
      }

      const byteSizeBefore = asset.byteSize;
      const rawSha256Before = asset.sha256;
      const byteSizeAfter = await fileByteSize(absoluteAssetPath);
      const sha256After = await sha256File(absoluteAssetPath);
      const sha256Before =
        typeof rawSha256Before === "string"
          ? rawSha256Before.toLowerCase()
          : rawSha256Before;
      const assetChanged =
        byteSizeBefore !== byteSizeAfter || sha256Before !== sha256After;
      if (assetChanged) {
        changed = true;
        asset.byteSize = byteSizeAfter;
        asset.sha256 = sha256After;
      }

      assets.push({
        manifestPath,
        assetPath: toPosixPath(
          path.join(path.posix.dirname(manifestPath), normalizedAssetPath),
        ),
        role: stringField(asset.role),
        byteSizeBefore,
        byteSizeAfter,
        sha256Before,
        sha256After,
        changed: assetChanged,
      });
    }

    if (changed) {
      manifest.updatedAt = timestamp;
    }
    if (changed && !dryRun) {
      await writeJsonFile(absoluteManifestPath, manifest);
    }

    manifests.push({
      manifestPath,
      entryId,
      kind,
      changed,
      dryRun,
      assets,
    });
  }

  return {
    scanned: manifests.length,
    changed: manifests.filter((manifest) => manifest.changed).length,
    dryRun,
    manifests,
  };
}
