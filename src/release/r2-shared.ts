import path from "node:path";

import type { ProfileManifest } from "../manifest/types";
import {
  MEDIA_TYPE_BY_EXTENSION,
  PRIMARY_ROLE_BY_KIND_AND_FORMAT,
} from "../manifest/types";

export const DEFAULT_R2_PUBLIC_BASE_URL = "https://profiles.lumaforge.invalid";
export const BLOB_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const RELEASE_CACHE_CONTROL = "public, max-age=86400, immutable";
export const CHANNEL_CACHE_CONTROL =
  "public, max-age=60, stale-while-revalidate=600";

export type R2ReleaseObjectPhase =
  | "blob"
  | "release-entry"
  | "release-catalog"
  | "release-metadata"
  | "channel";

export interface BlobReference {
  entryId: string;
  role: string;
  originalPath: string;
}

export interface BuiltBlob {
  key: string;
  url: string;
  mediaType: string;
  size: number;
  sha256: string;
  sourcePath: string;
  references: BlobReference[];
}

export interface ReleaseAssetDocument {
  role: string;
  mediaType: string;
  originalPath: string;
  size: number;
  sha256: string;
  key: string;
  url: string;
}

export interface CatalogPrimaryAsset {
  role: string;
  mediaType: string;
  size: number;
  sha256: string;
  url: string;
}

export interface CatalogEntryDocument {
  id: string;
  kind: string;
  version: string;
  title: string;
  license: string;
  redistributionAllowed: true;
  primaryAsset: CatalogPrimaryAsset;
  entryUrl: string;
}

export interface ReleaseCatalog {
  schemaVersion: 1;
  id: string;
  title: string;
  description: string;
  tag: string;
  generatedAt: string;
  publicBaseUrl: string;
  entries: CatalogEntryDocument[];
}

export interface ReleaseEntryDocument extends Omit<
  ProfileManifest,
  "assets" | "redistributionAllowed"
> {
  manifestPath: string;
  entryUrl: string;
  redistributionAllowed: true;
  primaryAsset: CatalogPrimaryAsset;
  assets: ReleaseAssetDocument[];
}

export interface ReleaseMetadataDocument {
  schemaVersion: 1;
  tag: string;
  createdAt: string;
  entryCount: number;
  blobCount: number;
  totalBlobBytes: number;
  catalogUrl: string;
  channelNames: string[];
  sourceGitCommit: string | null;
}

export interface BlobsManifestDocument {
  schemaVersion: 1;
  tag: string;
  generatedAt: string;
  totalBlobBytes: number;
  blobs: Array<{
    key: string;
    url: string;
    mediaType: string;
    size: number;
    sha256: string;
    references: BlobReference[];
  }>;
}

export interface R2ReleaseObject {
  phase: R2ReleaseObjectPhase;
  key: string;
  url: string;
  localPath: string;
  contentType: string;
  cacheControl: string;
  size: number;
}

export interface R2PublishPlanDocument {
  schemaVersion: 1;
  tag: string;
  generatedAt: string;
  publicBaseUrl: string;
  channelNames: string[];
  objects: Array<{
    phase: R2ReleaseObjectPhase;
    key: string;
    url: string;
    localPath: string;
    contentType: string;
    cacheControl: string;
    size: number;
    action: "check-remote" | "upload";
  }>;
}

export interface BuiltReleaseEntryFile {
  entryId: string;
  localPath: string;
  key: string;
  document: ReleaseEntryDocument;
}

export interface BuildR2ReleaseResult {
  outputDir: string;
  catalogPath: string;
  releasePath: string;
  blobsManifestPath: string;
  publishPlanPath: string;
  checksumsPath: string;
  catalog: ReleaseCatalog;
  release: ReleaseMetadataDocument;
  blobsManifest: BlobsManifestDocument;
  publishPlan: R2PublishPlanDocument;
  blobs: BuiltBlob[];
  entries: BuiltReleaseEntryFile[];
  objects: R2ReleaseObject[];
}

export function normalizePublicBaseUrl(value: string | undefined) {
  const raw = (value ?? DEFAULT_R2_PUBLIC_BASE_URL).trim();
  if (!raw) {
    throw new Error("Public base URL is required.");
  }
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export function joinPublicUrl(baseUrl: string, key: string) {
  return new URL(key, normalizePublicBaseUrl(baseUrl)).toString();
}

export function blobKeyFromAsset(assetPath: string, sha256: string) {
  const extension = path.posix.extname(assetPath).toLowerCase() || ".bin";
  return `blobs/sha256/${sha256.slice(0, 2)}/${sha256.slice(2, 4)}/${sha256}${extension}`;
}

export function releaseEntryKey(tag: string, entryId: string) {
  return `releases/${tag}/entries/${entryId}.json`;
}

export function primaryRoleForManifest(
  manifest: Pick<ProfileManifest, "kind" | "format">,
) {
  return PRIMARY_ROLE_BY_KIND_AND_FORMAT[
    `${manifest.kind}:${String(manifest.format)}`
  ];
}

export function selectPrimaryAsset(
  manifest: Pick<ProfileManifest, "kind" | "format" | "id">,
  assets: ReleaseAssetDocument[],
): CatalogPrimaryAsset {
  const primaryRole = primaryRoleForManifest(manifest);
  if (!primaryRole) {
    throw new Error(
      `No primary asset role mapping exists for ${manifest.id} (${manifest.kind}/${String(manifest.format)}).`,
    );
  }
  const asset = assets.find((candidate) => candidate.role === primaryRole);
  if (!asset) {
    throw new Error(
      `Primary asset ${primaryRole} is missing for ${manifest.id}.`,
    );
  }
  return {
    role: asset.role,
    mediaType: asset.mediaType,
    size: asset.size,
    sha256: asset.sha256,
    url: asset.url,
  };
}

export function cacheControlForObjectKey(key: string) {
  if (key.startsWith("blobs/sha256/")) {
    return BLOB_CACHE_CONTROL;
  }
  if (key.startsWith("channels/")) {
    return CHANNEL_CACHE_CONTROL;
  }
  return RELEASE_CACHE_CONTROL;
}

export function contentTypeForObjectKey(key: string, fallback?: string) {
  const extension = path.posix.extname(key).toLowerCase();
  return (
    fallback ?? MEDIA_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream"
  );
}
