export const PROFILE_KINDS = [
  "lut",
  "look-profile",
  "camera-profile",
  "lens-correction-profile",
  "color-transform-profile",
] as const;

export type ProfileKind = (typeof PROFILE_KINDS)[number];

export type ProfileFormat = "cube" | "dcp" | "lcp" | "icc" | "json" | string;

export type ProfileSource =
  | "original"
  | "local-import"
  | "third-party"
  | "derived"
  | string;

export const PROFILE_ASSET_ROLES = [
  "cube-lut",
  "camera-profile",
  "dcp",
  "icc",
  "lens-correction",
  "lcp",
  "look-profile",
  "color-transform",
  "metadata",
  "license",
  "notice",
] as const;

export type ProfileAssetRole = (typeof PROFILE_ASSET_ROLES)[number];

export interface ProfileAsset {
  role: string;
  path: string;
  mediaType: string;
  byteSize: number;
  sha256: string;
}

export interface CubeMetadata {
  title?: string;
  dimension?: "1d" | "3d";
  size?: number;
  domainMin?: [number, number, number];
  domainMax?: [number, number, number];
  vendor?: string;
  inputTransfer?: string;
  inputGamut?: string;
  outputTransfer?: string;
  outputGamut?: string;
  intent?: LUTIntent;
  family?: string;
  variant?: string;
  contractSource?: string;
  contractSourceId?: string;
  contractConfidence?: "high" | "medium" | "low" | string;
  sourceInputTransfer?: string;
  sourceInputGamut?: string;
  sourceOutputTransfer?: string;
  sourceOutputGamut?: string;
  sourceLutSize?: number;
  sourceContractSource?: string;
  sourceContractSourceId?: string;
}

export interface ProfileManifest {
  schemaVersion: 1;
  id: string;
  kind: ProfileKind;
  format: ProfileFormat;
  version: string;
  title: string;
  description: string | null;
  license: string;
  author: string;
  source: ProfileSource;
  sourceUrl: string | null;
  redistributionAllowed: boolean;
  targets: Record<string, unknown>;
  assets: ProfileAsset[];
  createdAt: string;
  updatedAt: string;
  lut?: CubeMetadata;
  [key: string]: unknown;
}

export interface RepositoryEntry {
  id: string;
  kind: ProfileKind;
  format: ProfileFormat;
  version: string;
  title: string;
  manifest: string;
  lut?: CubeMetadata;
}

export interface RepositoryManifest {
  schemaVersion: 1;
  id: string;
  title: string;
  description: string;
  entriesRoot: string;
  defaultEntryGlob: string;
  generatedAt: string;
  entries: RepositoryEntry[];
  [key: string]: unknown;
}

export interface ReleaseIndexAsset {
  role: string;
  mediaType: string;
  originalPath: string;
  releaseAssetName: string;
  size: number;
  sha256: string;
  download: {
    type: "github-release-asset";
    url: string;
  };
}

export interface ReleaseIndexEntry extends Omit<ProfileManifest, "assets"> {
  manifest: {
    originalPath: string;
    releaseAssetName: string;
  };
  assets: ReleaseIndexAsset[];
}

export interface ReleaseIndex {
  schemaVersion: 1;
  id: string;
  title: string;
  description: string;
  version: string;
  generatedAt: string;
  release: {
    provider: "github";
    owner: string;
    repo: string;
    tag: string;
  };
  entries: ReleaseIndexEntry[];
}

export const FORMAT_BY_KIND: Record<ProfileKind, string[]> = {
  lut: ["cube"],
  "look-profile": ["json"],
  "camera-profile": ["dcp", "icc", "json"],
  "lens-correction-profile": ["lcp", "json"],
  "color-transform-profile": ["json", "icc"],
};

export const PRIMARY_ROLE_BY_KIND_AND_FORMAT: Record<string, string> = {
  "lut:cube": "cube-lut",
  "look-profile:json": "look-profile",
  "camera-profile:dcp": "dcp",
  "camera-profile:icc": "icc",
  "camera-profile:json": "camera-profile",
  "lens-correction-profile:lcp": "lcp",
  "lens-correction-profile:json": "lens-correction",
  "color-transform-profile:json": "color-transform",
  "color-transform-profile:icc": "icc",
};

export const MEDIA_TYPE_BY_EXTENSION: Record<string, string> = {
  ".cube": "application/x-cube-lut",
  ".dcp": "application/x-adobe-dng-camera-profile",
  ".lcp": "application/x-adobe-lens-correction-profile",
  ".json": "application/json",
  ".icc": "application/vnd.iccprofile",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

export const KIND_SHORT_BY_KIND: Record<ProfileKind, string> = {
  lut: "lut",
  "look-profile": "look",
  "camera-profile": "camera",
  "lens-correction-profile": "lens",
  "color-transform-profile": "color-transform",
};

export const ID_KIND_SEGMENT_BY_KIND: Record<ProfileKind, string> = {
  lut: "lut",
  "look-profile": "look",
  "camera-profile": "camera",
  "lens-correction-profile": "lens",
  "color-transform-profile": "color-transform",
};

export const LUT_INTENTS = [
  "look",
  "technical-output",
  "display-look",
  "scene-creative",
  "combined-look-output",
  "monitoring",
  "calibration",
  "unknown",
] as const;

export type LUTIntent = (typeof LUT_INTENTS)[number];
