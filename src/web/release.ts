import type { ProfileManifest } from "../manifest/types";
import type { WebProfilesWorkspace, WebWorkspaceEntry } from "./workspace";

export type BrowserS3ObjectPhase =
  | "blob"
  | "release-entry"
  | "release-catalog"
  | "release-metadata"
  | "channel";

export interface BrowserS3ReleasePlanObject {
  phase: BrowserS3ObjectPhase;
  key: string;
  url: string;
  action: "skip" | "upload" | "update";
  contentType: string;
  cacheControl: string;
  size: number;
}

export interface BrowserS3CatalogEntry {
  id: string;
  kind: string;
  version: string;
  title: string;
  license: string;
  redistributionAllowed: true;
  primaryAsset: {
    role: string;
    mediaType: string;
    size: number;
    sha256: string;
    url: string;
  };
  entryUrl: string;
  family?: string;
}

export interface BrowserS3ReleaseCatalog {
  schemaVersion: 1;
  id: string;
  title: string;
  description: string;
  tag: string;
  generatedAt: string;
  publicBaseUrl: string;
  entries: BrowserS3CatalogEntry[];
}

export interface BrowserS3ReleasePlan {
  tag: string;
  catalog: BrowserS3ReleaseCatalog;
  release: {
    schemaVersion: 1;
    tag: string;
    createdAt: string;
    entryCount: number;
    blobCount: number;
    totalBlobBytes: number;
    catalogUrl: string;
    channelNames: string[];
    sourceGitCommit: null;
  };
  objects: BrowserS3ReleasePlanObject[];
}

export interface BrowserReleasePackageFile {
  path: string;
  contentType: string;
  body: string;
}

export interface BrowserReleasePackage {
  schemaVersion: 1;
  tag: string;
  generatedAt: string;
  files: BrowserReleasePackageFile[];
}

export interface BuildBrowserS3ReleasePlanOptions {
  tag: string;
  publicBaseUrl: string;
  channels?: string[];
  existingBlobKeys?: string[];
  generatedAt?: string;
}

const BLOB_CACHE_CONTROL = "public, max-age=31536000, immutable";
const RELEASE_CACHE_CONTROL = "public, max-age=86400, immutable";
const CHANNEL_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=600";

function normalizePublicBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function joinPublicUrl(baseUrl: string, key: string) {
  return new URL(key, normalizePublicBaseUrl(baseUrl)).toString();
}

function extensionForPath(value: string) {
  const name = value.split(/[\\/]/).pop() ?? value;
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : ".bin";
}

function blobKey(assetPath: string, sha256: string) {
  const extension = extensionForPath(assetPath);
  return `blobs/sha256/${sha256.slice(0, 2)}/${sha256.slice(2, 4)}/${sha256}${extension}`;
}

function releaseEntryKey(tag: string, entryId: string) {
  return `releases/${tag}/entries/${entryId}.json`;
}

function cacheControlForKey(key: string) {
  if (key.startsWith("blobs/sha256/")) {
    return BLOB_CACHE_CONTROL;
  }
  if (key.startsWith("channels/")) {
    return CHANNEL_CACHE_CONTROL;
  }
  return RELEASE_CACHE_CONTROL;
}

function primaryAsset(manifest: ProfileManifest) {
  const asset = manifest.assets.find((candidate) => candidate.role === "cube-lut") ?? manifest.assets[0];
  if (!asset) {
    throw new Error(`Entry ${manifest.id} has no assets.`);
  }
  return asset;
}

function assertPublishable(entry: WebWorkspaceEntry) {
  if (!entry.review.reviewed || entry.review.warnings.length > 0) {
    throw new Error(`Entry ${entry.id} must be reviewed before publishing.`);
  }
  if (!entry.manifest.redistributionAllowed) {
    throw new Error(`Entry ${entry.id} is not marked redistributable.`);
  }
  const lut = entry.manifest.lut;
  if (!lut?.inputTransfer || !lut.inputGamut || !lut.outputTransfer || !lut.outputGamut) {
    throw new Error(`Entry ${entry.id} is missing a complete LUT contract.`);
  }
}

export function buildBrowserS3ReleasePlan(
  workspace: WebProfilesWorkspace,
  options: BuildBrowserS3ReleasePlanOptions,
): BrowserS3ReleasePlan {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const publicBaseUrl = normalizePublicBaseUrl(options.publicBaseUrl).replace(/\/$/, "");
  const existingBlobKeys = new Set(options.existingBlobKeys ?? []);
  const channelNames = [...new Set((options.channels ?? []).map((channel) => channel.trim()).filter(Boolean))];

  for (const entry of workspace.entries) {
    assertPublishable(entry);
  }

  const objects: BrowserS3ReleasePlanObject[] = [];
  const catalogEntries: BrowserS3CatalogEntry[] = [];
  const seenBlobKeys = new Set<string>();
  let totalBlobBytes = 0;

  for (const entry of workspace.entries) {
    const manifest = entry.manifest;
    const asset = primaryAsset(manifest);
    const key = blobKey(asset.path, asset.sha256);
    const assetUrl = joinPublicUrl(publicBaseUrl, key);
    totalBlobBytes += seenBlobKeys.has(key) ? 0 : asset.byteSize;

    if (!seenBlobKeys.has(key)) {
      seenBlobKeys.add(key);
      objects.push({
        phase: "blob",
        key,
        url: assetUrl,
        action: existingBlobKeys.has(key) ? "skip" : "upload",
        contentType: asset.mediaType,
        cacheControl: cacheControlForKey(key),
        size: asset.byteSize,
      });
    }

    const entryKey = releaseEntryKey(options.tag, manifest.id);
    const entryUrl = joinPublicUrl(publicBaseUrl, entryKey);
    catalogEntries.push({
      id: manifest.id,
      kind: manifest.kind,
      version: manifest.version,
      title: manifest.title,
      license: manifest.license,
      redistributionAllowed: true,
      primaryAsset: {
        role: asset.role,
        mediaType: asset.mediaType,
        size: asset.byteSize,
        sha256: asset.sha256,
        url: assetUrl,
      },
      entryUrl,
      ...(manifest.lut?.family ? { family: manifest.lut.family } : {}),
    });
    objects.push({
      phase: "release-entry",
      key: entryKey,
      url: entryUrl,
      action: "upload",
      contentType: "application/json",
      cacheControl: cacheControlForKey(entryKey),
      size: 0,
    });
  }

  const catalogKey = `releases/${options.tag}/catalog.json`;
  const releaseKey = `releases/${options.tag}/release.json`;
  const blobsManifestKey = `releases/${options.tag}/blobs-manifest.json`;
  const catalog: BrowserS3ReleaseCatalog = {
    schemaVersion: 1,
    id: "lumaforge-profiles",
    title: "LumaForge Profiles",
    description: "Browser-built LumaForge profile catalog",
    tag: options.tag,
    generatedAt,
    publicBaseUrl,
    entries: catalogEntries,
  };
  const release: BrowserS3ReleasePlan["release"] = {
    schemaVersion: 1,
    tag: options.tag,
    createdAt: generatedAt,
    entryCount: catalogEntries.length,
    blobCount: seenBlobKeys.size,
    totalBlobBytes,
    catalogUrl: joinPublicUrl(publicBaseUrl, catalogKey),
    channelNames,
    sourceGitCommit: null,
  };

  objects.push(
    {
      phase: "release-catalog",
      key: catalogKey,
      url: joinPublicUrl(publicBaseUrl, catalogKey),
      action: "upload",
      contentType: "application/json",
      cacheControl: cacheControlForKey(catalogKey),
      size: 0,
    },
    {
      phase: "release-metadata",
      key: releaseKey,
      url: joinPublicUrl(publicBaseUrl, releaseKey),
      action: "upload",
      contentType: "application/json",
      cacheControl: cacheControlForKey(releaseKey),
      size: 0,
    },
    {
      phase: "release-metadata",
      key: blobsManifestKey,
      url: joinPublicUrl(publicBaseUrl, blobsManifestKey),
      action: "upload",
      contentType: "application/json",
      cacheControl: cacheControlForKey(blobsManifestKey),
      size: 0,
    },
  );

  for (const channel of channelNames) {
    for (const name of ["catalog", "release"] as const) {
      const key = `channels/${channel}/${name}.json`;
      objects.push({
        phase: "channel",
        key,
        url: joinPublicUrl(publicBaseUrl, key),
        action: "update",
        contentType: "application/json",
        cacheControl: cacheControlForKey(key),
        size: 0,
      });
    }
  }

  return {
    tag: options.tag,
    catalog,
    release,
    objects,
  };
}

function releaseEntryDocument(entry: WebWorkspaceEntry, tag: string, publicBaseUrl: string) {
  const manifest = entry.manifest;
  const asset = primaryAsset(manifest);
  const key = blobKey(asset.path, asset.sha256);
  const entryKey = releaseEntryKey(tag, manifest.id);
  const { assets: _assets, ...manifestFields } = manifest;
  return {
    ...manifestFields,
    manifestPath: `profiles/${manifest.id}/manifest.json`,
    entryUrl: joinPublicUrl(publicBaseUrl, entryKey),
    redistributionAllowed: true,
    primaryAsset: {
      role: asset.role,
      mediaType: asset.mediaType,
      size: asset.byteSize,
      sha256: asset.sha256,
      url: joinPublicUrl(publicBaseUrl, key),
    },
    assets: manifest.assets.map((item) => {
      const itemKey = blobKey(item.path, item.sha256);
      return {
        role: item.role,
        mediaType: item.mediaType,
        originalPath: item.path,
        size: item.byteSize,
        sha256: item.sha256,
        key: itemKey,
        url: joinPublicUrl(publicBaseUrl, itemKey),
      };
    }),
  };
}

export function buildBrowserReleasePackage(
  workspace: WebProfilesWorkspace,
  options: BuildBrowserS3ReleasePlanOptions,
): BrowserReleasePackage {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const publicBaseUrl = normalizePublicBaseUrl(options.publicBaseUrl).replace(/\/$/, "");
  const plan = buildBrowserS3ReleasePlan(workspace, {
    ...options,
    generatedAt,
  });
  const blobs = new Map<string, BrowserReleasePackageFile>();
  const entries = workspace.entries.map((entry) => ({
    entry,
    document: releaseEntryDocument(entry, options.tag, publicBaseUrl),
  }));

  for (const entry of workspace.entries) {
    const asset = primaryAsset(entry.manifest);
    const key = blobKey(asset.path, asset.sha256);
    if (!entry.file?.text) {
      continue;
    }
    blobs.set(key, {
      path: key,
      contentType: asset.mediaType,
      body: entry.file.text,
    });
  }

  const blobsManifest = {
    schemaVersion: 1 as const,
    tag: options.tag,
    generatedAt,
    totalBlobBytes: [...blobs.values()].reduce((total, file) => total + new TextEncoder().encode(file.body).byteLength, 0),
    blobs: [...blobs.values()].map((file) => ({
      key: file.path,
      url: joinPublicUrl(publicBaseUrl, file.path),
      mediaType: file.contentType,
      size: new TextEncoder().encode(file.body).byteLength,
      sha256: file.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "",
      references: entries
        .filter(({ entry }) => blobKey(primaryAsset(entry.manifest).path, primaryAsset(entry.manifest).sha256) === file.path)
        .map(({ entry }) => ({
          entryId: entry.id,
          role: primaryAsset(entry.manifest).role,
          originalPath: primaryAsset(entry.manifest).path,
        })),
    })),
  };
  const publishPlan = {
    schemaVersion: 1 as const,
    tag: options.tag,
    generatedAt,
    publicBaseUrl,
    channelNames: plan.release.channelNames,
    objects: plan.objects.map((object) => ({
      phase: object.phase,
      key: object.key,
      url: object.url,
      localPath:
        object.key === `releases/${options.tag}/catalog.json` || object.key.endsWith("/catalog.json")
          ? "catalog.json"
          : object.key === `releases/${options.tag}/release.json` || object.key.endsWith("/release.json")
            ? "release.json"
            : object.key === `releases/${options.tag}/blobs-manifest.json`
              ? "blobs-manifest.json"
              : object.key.startsWith(`releases/${options.tag}/entries/`)
                ? object.key.replace(`releases/${options.tag}/`, "")
                : object.key,
      contentType: object.contentType,
      cacheControl: object.cacheControl,
      size: object.size,
      action: object.action === "skip" ? "check-remote" : "upload",
    })),
  };

  return {
    schemaVersion: 1,
    tag: options.tag,
    generatedAt,
    files: [
      {
        path: "catalog.json",
        contentType: "application/json",
        body: JSON.stringify(plan.catalog, null, 2),
      },
      {
        path: "release.json",
        contentType: "application/json",
        body: JSON.stringify(plan.release, null, 2),
      },
      {
        path: "blobs-manifest.json",
        contentType: "application/json",
        body: JSON.stringify(blobsManifest, null, 2),
      },
      {
        path: "publish-plan.json",
        contentType: "application/json",
        body: JSON.stringify(publishPlan, null, 2),
      },
      ...entries.map(({ entry, document }) => ({
        path: `entries/${entry.id}.json`,
        contentType: "application/json",
        body: JSON.stringify(document, null, 2),
      })),
      ...[...blobs.values()],
    ],
  };
}
