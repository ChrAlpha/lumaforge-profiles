import path from "node:path";

import { execa } from "execa";

import { generateRepositoryIndex } from "../manifest";
import { formatValidationIssue, validateProfiles } from "../manifest/validate";
import type { ProfileKind, ProfileManifest } from "../manifest/types";
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
import {
  blobKeyFromAsset,
  cacheControlForObjectKey,
  contentTypeForObjectKey,
  joinPublicUrl,
  normalizePublicBaseUrl,
  releaseEntryKey,
  selectPrimaryAsset,
  type BlobReference,
  type BuildR2ReleaseResult,
  type BuiltBlob,
  type BuiltReleaseEntryFile,
  type CatalogEntryDocument,
  type ReleaseAssetDocument,
  type ReleaseCatalog,
  type ReleaseEntryDocument,
  type ReleaseMetadataDocument,
  type R2PublishPlanDocument,
  type R2ReleaseObject,
} from "./r2-shared";

export interface BuildR2ReleaseOptions {
  rootDir: string;
  tag: string;
  publicBaseUrl?: string;
  channelNames?: string[];
  allowedKinds?: ProfileKind[];
  now?: string;
}

interface ChecksumTarget {
  relativePath: string;
  filePath: string;
}

async function resolveGitCommit(rootDir: string) {
  try {
    const result = await execa("git", ["rev-parse", "HEAD"], { cwd: rootDir });
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

async function checksumLine(target: ChecksumTarget) {
  return {
    relativePath: target.relativePath,
    sha256: await sha256File(target.filePath),
  };
}

function buildEntryDocument(params: {
  manifest: ProfileManifest;
  manifestPath: string;
  entryUrl: string;
  assets: ReleaseAssetDocument[];
}): ReleaseEntryDocument {
  const { assets: _ignored, ...manifestFields } = params.manifest;
  return {
    ...manifestFields,
    manifestPath: params.manifestPath,
    entryUrl: params.entryUrl,
    redistributionAllowed: true,
    primaryAsset: selectPrimaryAsset(params.manifest, params.assets),
    assets: params.assets,
  };
}

export async function buildR2Release(
  options: BuildR2ReleaseOptions,
): Promise<BuildR2ReleaseResult> {
  const generatedAt = options.now ?? nowIso();
  const publicBaseUrl = normalizePublicBaseUrl(
    options.publicBaseUrl ?? process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL,
  );
  const channelNames = [
    ...new Set(
      (options.channelNames ?? []).map((value) => value.trim()).filter(Boolean),
    ),
  ];
  const validation = await validateProfiles({
    rootDir: options.rootDir,
    release: true,
    allowedKinds: options.allowedKinds,
  });
  if (validation.errors.length > 0) {
    throw new Error(validation.errors.map(formatValidationIssue).join("\n"));
  }

  const repository = await generateRepositoryIndex({
    rootDir: options.rootDir,
    now: generatedAt,
  });
  const manifestsByPath = new Map(
    validation.manifests.map((item) => [item.manifestPath, item]),
  );
  const outputDir = path.join(
    options.rootDir,
    "dist",
    "r2-release",
    options.tag,
  );
  const entriesDir = path.join(outputDir, "entries");
  await fs.emptyDir(outputDir);
  await fs.ensureDir(entriesDir);

  const blobsByKey = new Map<string, BuiltBlob>();
  const entries: BuiltReleaseEntryFile[] = [];
  const checksumTargets: ChecksumTarget[] = [];

  for (const entry of repository.entries) {
    const discovered = manifestsByPath.get(entry.manifest);
    if (!discovered) {
      throw new Error(
        `Validated manifest is missing from release build: ${entry.manifest}`,
      );
    }

    const manifest = discovered.manifest;
    const releaseAssets: ReleaseAssetDocument[] = [];

    for (const asset of manifest.assets) {
      if (!isSafeRelativePosixPath(asset.path)) {
        throw new Error(
          `Unsafe asset path in ${entry.manifest}: ${asset.path}`,
        );
      }
      const normalizedAssetPath = path.posix.normalize(asset.path);
      const absoluteAssetPath = path.join(
        options.rootDir,
        discovered.entryDir,
        normalizedAssetPath,
      );
      const key = blobKeyFromAsset(normalizedAssetPath, asset.sha256);
      const url = joinPublicUrl(publicBaseUrl, key);
      const reference: BlobReference = {
        entryId: manifest.id,
        role: asset.role,
        originalPath: asset.path,
      };
      if (!blobsByKey.has(key)) {
        blobsByKey.set(key, {
          key,
          url,
          mediaType: asset.mediaType,
          size: asset.byteSize,
          sha256: asset.sha256,
          sourcePath: absoluteAssetPath,
          references: [reference],
        });
      } else {
        blobsByKey.get(key)!.references.push(reference);
      }
      releaseAssets.push({
        role: asset.role,
        mediaType: asset.mediaType,
        originalPath: asset.path,
        size: asset.byteSize,
        sha256: asset.sha256,
        key,
        url,
      });
    }

    const entryKey = releaseEntryKey(options.tag, manifest.id);
    const entryUrl = joinPublicUrl(publicBaseUrl, entryKey);
    const document = buildEntryDocument({
      manifest,
      manifestPath: entry.manifest,
      entryUrl,
      assets: releaseAssets,
    });
    const localPath = path.join(entriesDir, `${manifest.id}.json`);
    await writeJsonFile(localPath, document);
    checksumTargets.push({
      filePath: localPath,
      relativePath: toPosixPath(path.relative(outputDir, localPath)),
    });
    entries.push({
      entryId: manifest.id,
      localPath,
      key: entryKey,
      document,
    });
  }

  entries.sort((a, b) => a.entryId.localeCompare(b.entryId));
  const blobs = [...blobsByKey.values()].sort((a, b) =>
    a.key.localeCompare(b.key),
  );
  const totalBlobBytes = blobs.reduce((total, blob) => total + blob.size, 0);

  const catalog: ReleaseCatalog = {
    schemaVersion: 1,
    id: repository.id,
    title: repository.title,
    description: repository.description,
    tag: options.tag,
    generatedAt,
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ""),
    entries: entries.map((entry): CatalogEntryDocument => {
      const base: CatalogEntryDocument = {
        id: String(entry.document.id),
        kind: String(entry.document.kind),
        version: String(entry.document.version),
        title: String(entry.document.title),
        license: String(entry.document.license),
        redistributionAllowed: true,
        primaryAsset: entry.document.primaryAsset,
        entryUrl: entry.document.entryUrl,
      };
      const lutMeta = entry.document.lut as { family?: string } | undefined;
      if (lutMeta?.family) base.family = String(lutMeta.family);
      return base;
    }),
  };
  const catalogPath = path.join(outputDir, "catalog.json");
  await writeJsonFile(catalogPath, catalog);
  checksumTargets.push({
    filePath: catalogPath,
    relativePath: "catalog.json",
  });

  const release: ReleaseMetadataDocument = {
    schemaVersion: 1,
    tag: options.tag,
    createdAt: generatedAt,
    entryCount: entries.length,
    blobCount: blobs.length,
    totalBlobBytes,
    catalogUrl: joinPublicUrl(
      publicBaseUrl,
      `releases/${options.tag}/catalog.json`,
    ),
    channelNames,
    sourceGitCommit: await resolveGitCommit(options.rootDir),
  };
  const releasePath = path.join(outputDir, "release.json");
  await writeJsonFile(releasePath, release);
  checksumTargets.push({
    filePath: releasePath,
    relativePath: "release.json",
  });

  const blobsManifest = {
    schemaVersion: 1 as const,
    tag: options.tag,
    generatedAt,
    totalBlobBytes,
    blobs: blobs.map((blob) => ({
      key: blob.key,
      url: blob.url,
      mediaType: blob.mediaType,
      size: blob.size,
      sha256: blob.sha256,
      references: blob.references,
    })),
  };
  const blobsManifestPath = path.join(outputDir, "blobs-manifest.json");
  await writeJsonFile(blobsManifestPath, blobsManifest);
  checksumTargets.push({
    filePath: blobsManifestPath,
    relativePath: "blobs-manifest.json",
  });

  const objects: R2ReleaseObject[] = [];
  for (const blob of blobs) {
    objects.push({
      phase: "blob",
      key: blob.key,
      url: blob.url,
      localPath: blob.sourcePath,
      contentType: blob.mediaType,
      cacheControl: cacheControlForObjectKey(blob.key),
      size: blob.size,
    });
  }

  for (const entry of entries) {
    objects.push({
      phase: "release-entry",
      key: entry.key,
      url: joinPublicUrl(publicBaseUrl, entry.key),
      localPath: entry.localPath,
      contentType: "application/json",
      cacheControl: cacheControlForObjectKey(entry.key),
      size: await fileByteSize(entry.localPath),
    });
  }

  objects.push(
    {
      phase: "release-catalog",
      key: `releases/${options.tag}/catalog.json`,
      url: joinPublicUrl(publicBaseUrl, `releases/${options.tag}/catalog.json`),
      localPath: catalogPath,
      contentType: "application/json",
      cacheControl: cacheControlForObjectKey(
        `releases/${options.tag}/catalog.json`,
      ),
      size: await fileByteSize(catalogPath),
    },
    {
      phase: "release-metadata",
      key: `releases/${options.tag}/release.json`,
      url: joinPublicUrl(publicBaseUrl, `releases/${options.tag}/release.json`),
      localPath: releasePath,
      contentType: "application/json",
      cacheControl: cacheControlForObjectKey(
        `releases/${options.tag}/release.json`,
      ),
      size: await fileByteSize(releasePath),
    },
    {
      phase: "release-metadata",
      key: `releases/${options.tag}/blobs-manifest.json`,
      url: joinPublicUrl(
        publicBaseUrl,
        `releases/${options.tag}/blobs-manifest.json`,
      ),
      localPath: blobsManifestPath,
      contentType: "application/json",
      cacheControl: cacheControlForObjectKey(
        `releases/${options.tag}/blobs-manifest.json`,
      ),
      size: await fileByteSize(blobsManifestPath),
    },
  );

  const publishPlan: R2PublishPlanDocument = {
    schemaVersion: 1,
    tag: options.tag,
    generatedAt,
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ""),
    channelNames,
    objects: objects.map((object) => ({
      phase: object.phase,
      key: object.key,
      url: object.url,
      localPath: toPosixPath(path.relative(outputDir, object.localPath)),
      contentType: contentTypeForObjectKey(object.key, object.contentType),
      cacheControl: object.cacheControl,
      size: object.size,
      action: object.phase === "blob" ? "check-remote" : "upload",
    })),
  };
  const publishPlanPath = path.join(outputDir, "publish-plan.json");
  await writeJsonFile(publishPlanPath, publishPlan);
  checksumTargets.push({
    filePath: publishPlanPath,
    relativePath: "publish-plan.json",
  });

  const checksums = await Promise.all(
    checksumTargets.map((target) => checksumLine(target)),
  );
  const checksumsText = `${checksums
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    .map((entry) => `${entry.sha256}  ${entry.relativePath}`)
    .join("\n")}\n`;
  const checksumsPath = path.join(outputDir, "checksums.txt");
  await fs.writeFile(checksumsPath, checksumsText);

  return {
    outputDir,
    catalogPath,
    releasePath,
    blobsManifestPath,
    publishPlanPath,
    checksumsPath,
    catalog,
    release,
    blobsManifest,
    publishPlan,
    blobs,
    entries,
    objects,
  };
}

export interface LoadBuiltR2ReleaseOptions {
  rootDir: string;
  tag: string;
}

export async function loadBuiltR2Release(
  options: LoadBuiltR2ReleaseOptions,
): Promise<BuildR2ReleaseResult> {
  const outputDir = path.join(
    options.rootDir,
    "dist",
    "r2-release",
    options.tag,
  );
  const catalogPath = path.join(outputDir, "catalog.json");
  const releasePath = path.join(outputDir, "release.json");
  const blobsManifestPath = path.join(outputDir, "blobs-manifest.json");
  const publishPlanPath = path.join(outputDir, "publish-plan.json");
  const checksumsPath = path.join(outputDir, "checksums.txt");

  for (const filePath of [
    catalogPath,
    releasePath,
    blobsManifestPath,
    publishPlanPath,
  ]) {
    if (!(await fs.pathExists(filePath))) {
      throw new Error(
        `Missing built R2 release artifact ${filePath}. Run profiles build-r2 first.`,
      );
    }
  }

  const catalog = await readJsonFile<ReleaseCatalog>(catalogPath);
  const release = await readJsonFile<ReleaseMetadataDocument>(releasePath);
  const blobsManifest =
    await readJsonFile<BuildR2ReleaseResult["blobsManifest"]>(
      blobsManifestPath,
    );
  const publishPlan =
    await readJsonFile<R2PublishPlanDocument>(publishPlanPath);
  const objects: R2ReleaseObject[] = publishPlan.objects.map((object) => ({
    phase: object.phase,
    key: object.key,
    url: object.url,
    localPath: path.resolve(outputDir, object.localPath),
    contentType: object.contentType,
    cacheControl: object.cacheControl,
    size: object.size,
  }));
  const blobs: BuiltBlob[] = blobsManifest.blobs.map((blob) => {
    const object = objects.find((candidate) => candidate.key === blob.key);
    if (!object) {
      throw new Error(`Built R2 release is missing blob object ${blob.key}.`);
    }
    return {
      key: blob.key,
      url: blob.url,
      mediaType: blob.mediaType,
      size: blob.size,
      sha256: blob.sha256,
      sourcePath: object.localPath,
      references: blob.references,
    };
  });

  const entriesDir = path.join(outputDir, "entries");
  const entries: BuiltReleaseEntryFile[] = [];
  if (await fs.pathExists(entriesDir)) {
    const files = (await fs.readdir(entriesDir))
      .filter((name) => name.endsWith(".json"))
      .sort();
    for (const fileName of files) {
      const localPath = path.join(entriesDir, fileName);
      const document = await readJsonFile<ReleaseEntryDocument>(localPath);
      const entryId = String(document.id);
      entries.push({
        entryId,
        localPath,
        key: releaseEntryKey(options.tag, entryId),
        document,
      });
    }
  }

  return {
    outputDir,
    catalogPath,
    releasePath,
    blobsManifestPath,
    publishPlanPath,
    checksumsPath,
    catalog,
    release,
    blobsManifest,
    publishPlan,
    blobs,
    entries,
    objects,
  };
}
