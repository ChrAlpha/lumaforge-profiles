export const PROFILE_KINDS = [
  "lut",
  "look-profile",
  "camera-profile",
  "lens-correction-profile",
  "color-transform-profile"
] as const;

export type ProfileKind = (typeof PROFILE_KINDS)[number];

export type ProfileFormat = "cube" | "dcp" | "lcp" | string;

export type ProfileSource = "original" | "local-import" | "third-party" | "derived" | string;

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
  version: string;
  title: string;
  manifest: string;
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

export interface PackManifestEntry {
  id: string;
  manifest: string;
}

export interface ReleasePackManifest {
  schemaVersion: 1;
  id: string;
  tag: string;
  kindFilter: ProfileKind[];
  entryCount: number;
  assetCount: number;
  uncompressedBytes: number;
  generatedAt: string;
  entries: PackManifestEntry[];
}

export interface ReleaseManifestPack {
  fileName: string;
  mediaType: "application/zip";
  byteSize: number;
  sha256: string;
  entryCount: number;
  assetCount: number;
  kindFilter: ProfileKind[];
}

export interface ReleaseManifest {
  schemaVersion: 1;
  id: string;
  tag: string;
  generatedAt: string;
  totalEntries: number;
  entriesByKind: Record<string, number>;
  packs: ReleaseManifestPack[];
}

export const FORMAT_BY_KIND: Record<ProfileKind, string[]> = {
  lut: ["cube"],
  "look-profile": [],
  "camera-profile": ["dcp"],
  "lens-correction-profile": ["lcp"],
  "color-transform-profile": []
};

export const ROLE_BY_FORMAT: Record<string, string> = {
  cube: "cube-lut",
  dcp: "dng-camera-profile",
  lcp: "lens-correction-profile"
};

export const KIND_SHORT_BY_KIND: Record<ProfileKind, string> = {
  lut: "lut",
  "look-profile": "look",
  "camera-profile": "camera",
  "lens-correction-profile": "lens",
  "color-transform-profile": "color-transform"
};

export const ID_KIND_SEGMENT_BY_KIND: Record<ProfileKind, string> = {
  lut: "lut",
  "look-profile": "look",
  "camera-profile": "camera",
  "lens-correction-profile": "lens",
  "color-transform-profile": "color-transform"
};
