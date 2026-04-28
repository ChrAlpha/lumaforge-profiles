import path from "node:path";

import {
  appendHashToEntryDirectory,
  appendHashToFileName,
  entryDirectoryName,
  entryId
} from "./normalize";
import { defaultTitleForProfile, inferTargets, parseCubeMetadata } from "./classify";
import { scanImportDirectory } from "./scan";
import { generateRepositoryIndex } from "../manifest";
import { validateProfiles, type ValidationResult } from "../manifest/validate";
import type { ProfileManifest } from "../manifest/types";
import { fileByteSize, fs, readJsonIfExists, toPosixPath, writeJsonFile } from "../utils/fs";
import { sha256File } from "../utils/hash";
import { sanitizeFileName, slugify } from "../utils/slug";
import { nowIso } from "../utils/time";

export interface ImportProfilesOptions {
  rootDir: string;
  fromDir: string;
  namespace: string;
  version?: string;
  source?: string;
  sourceUrl?: string | null;
  license?: string;
  author?: string;
  redistributionAllowed?: boolean;
  dryRun?: boolean;
  move?: boolean;
  overwriteAssets?: boolean;
  keepExistingMetadata?: boolean;
  now?: string;
}

export interface ImportWrittenEntry {
  sourcePath: string;
  entryDir: string;
  manifestPath: string;
  assetPath: string;
  id: string;
  action: "create" | "update";
}

export interface ImportProfilesResult {
  scanned: number;
  written: ImportWrittenEntry[];
  dryRun: boolean;
  validation?: ValidationResult;
}

function existingManifestPath(rootDir: string, relativeEntryDir: string) {
  return path.join(rootDir, relativeEntryDir, "manifest.json");
}

async function readExistingManifest(rootDir: string, relativeEntryDir: string) {
  return readJsonIfExists<ProfileManifest>(existingManifestPath(rootDir, relativeEntryDir));
}

async function chooseEntryDir(params: {
  rootDir: string;
  namespace: string;
  version: string;
  slug: string;
  hash: string;
  kind: ProfileManifest["kind"];
  usedEntryDirs: Set<string>;
}): Promise<{ relativeEntryDir: string; idSlug: string }> {
  const baseName = entryDirectoryName(params.kind, params.namespace, params.slug, params.version);
  const hashSlug = `${params.slug}-${params.hash.slice(0, 8)}`;
  const candidates = [
    { name: baseName, idSlug: params.slug },
    { name: appendHashToEntryDirectory(baseName, params.hash.slice(0, 8)), idSlug: hashSlug }
  ];

  for (const candidate of candidates) {
    const relativeEntryDir = toPosixPath(path.posix.join("profiles", candidate.name));
    if (params.usedEntryDirs.has(relativeEntryDir)) {
      continue;
    }

    const existing = await readExistingManifest(params.rootDir, relativeEntryDir);
    if (!existing || existing.id === entryId(params.kind, params.namespace, candidate.idSlug)) {
      params.usedEntryDirs.add(relativeEntryDir);
      return { relativeEntryDir, idSlug: candidate.idSlug };
    }
  }

  const fallback = toPosixPath(path.posix.join("profiles", appendHashToEntryDirectory(baseName, params.hash.slice(0, 8))));
  params.usedEntryDirs.add(fallback);
  return { relativeEntryDir: fallback, idSlug: hashSlug };
}

async function chooseAssetFileName(params: {
  entryFullPath: string;
  desiredFileName: string;
  sourceHash: string;
  overwriteAssets: boolean;
}) {
  const desiredPath = path.join(params.entryFullPath, "assets", params.desiredFileName);
  if (params.overwriteAssets || !(await fs.pathExists(desiredPath))) {
    return params.desiredFileName;
  }

  const existingHash = await sha256File(desiredPath);
  if (existingHash === params.sourceHash) {
    return params.desiredFileName;
  }

  return appendHashToFileName(params.desiredFileName, params.sourceHash.slice(0, 8));
}

function mergeManifest(existing: ProfileManifest, next: ProfileManifest, keepExistingMetadata: boolean): ProfileManifest {
  if (!keepExistingMetadata) {
    return {
      ...next,
      createdAt: existing.createdAt ?? next.createdAt
    };
  }

  return {
    ...existing,
    schemaVersion: 1,
    id: existing.id ?? next.id,
    kind: existing.kind ?? next.kind,
    format: existing.format ?? next.format,
    version: existing.version ?? next.version,
    description: existing.description ?? next.description,
    sourceUrl: existing.sourceUrl ?? next.sourceUrl,
    targets: existing.targets ?? next.targets,
    assets: next.assets,
    lut: next.lut ?? existing.lut,
    updatedAt: next.updatedAt
  };
}

export async function importProfiles(options: ImportProfilesOptions): Promise<ImportProfilesResult> {
  const version = options.version ?? "1.0.0";
  const timestamp = options.now ?? nowIso();
  const keepExistingMetadata = options.keepExistingMetadata ?? true;
  const scanned = await scanImportDirectory(options.fromDir);
  const usedEntryDirs = new Set<string>();
  const written: ImportWrittenEntry[] = [];

  for (const item of scanned) {
    const hash = await sha256File(item.absolutePath);
    const byteSize = await fileByteSize(item.absolutePath);
    const cubeMetadata = item.classification.format === "cube" ? await parseCubeMetadata(item.absolutePath) : undefined;
    const title = cubeMetadata?.title ?? defaultTitleForProfile(item.absolutePath);
    const slug = slugify(path.basename(item.absolutePath, path.extname(item.absolutePath)));
    const chosenEntry = await chooseEntryDir({
      rootDir: options.rootDir,
      namespace: options.namespace,
      version,
      slug,
      hash,
      kind: item.classification.kind,
      usedEntryDirs
    });
    const relativeEntryDir = chosenEntry.relativeEntryDir;
    const fullEntryDir = path.join(options.rootDir, relativeEntryDir);
    const desiredFileName = sanitizeFileName(path.basename(item.absolutePath));
    const assetFileName = await chooseAssetFileName({
      entryFullPath: fullEntryDir,
      desiredFileName,
      sourceHash: hash,
      overwriteAssets: options.overwriteAssets ?? false
    });
    const assetRelativePath = toPosixPath(path.posix.join("assets", assetFileName));
    const generatedId = entryId(item.classification.kind, options.namespace, chosenEntry.idSlug);
    const existing = await readExistingManifest(options.rootDir, relativeEntryDir);
    const targets = await inferTargets(item.absolutePath, item.classification);
    const nextManifest: ProfileManifest = {
      schemaVersion: 1,
      id: existing?.id ?? generatedId,
      kind: item.classification.kind,
      format: item.classification.format,
      version,
      title,
      description: null,
      license: options.license ?? "NOASSERTION",
      author: options.author ?? "Unknown",
      source: options.source ?? "local-import",
      sourceUrl: options.sourceUrl ?? null,
      redistributionAllowed: options.redistributionAllowed ?? false,
      targets,
      assets: [
        {
          role: item.classification.role,
          path: assetRelativePath,
          mediaType: item.classification.mediaType,
          byteSize,
          sha256: hash
        }
      ],
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      ...(cubeMetadata ? { lut: cubeMetadata } : {})
    };
    const manifest = existing ? mergeManifest(existing, nextManifest, keepExistingMetadata) : nextManifest;
    const manifestPath = path.join(fullEntryDir, "manifest.json");
    const assetPath = path.join(fullEntryDir, assetRelativePath);

    written.push({
      sourcePath: item.absolutePath,
      entryDir: relativeEntryDir,
      manifestPath: toPosixPath(path.relative(options.rootDir, manifestPath)),
      assetPath: toPosixPath(path.relative(options.rootDir, assetPath)),
      id: manifest.id,
      action: existing ? "update" : "create"
    });

    if (options.dryRun) {
      continue;
    }

    await fs.ensureDir(path.dirname(assetPath));
    if (options.move) {
      await fs.move(item.absolutePath, assetPath, { overwrite: options.overwriteAssets ?? false });
    } else {
      await fs.copy(item.absolutePath, assetPath, { overwrite: options.overwriteAssets ?? false });
    }
    await fs.ensureFile(path.join(fullEntryDir, "assets", ".gitkeep"));
    await writeJsonFile(manifestPath, manifest);
  }

  if (options.dryRun) {
    return {
      scanned: scanned.length,
      written,
      dryRun: true
    };
  }

  const validation = await validateProfiles({ rootDir: options.rootDir });
  await generateRepositoryIndex({ rootDir: options.rootDir, now: timestamp });

  return {
    scanned: scanned.length,
    written,
    dryRun: false,
    validation
  };
}
