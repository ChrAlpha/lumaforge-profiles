import type { CubeMetadata, ProfileManifest } from "../manifest/types";

export type WebWorkspaceEntryStatus =
  | "carried"
  | "new-draft"
  | "metadata-changed"
  | "duplicate-asset"
  | "validation-error"
  | "ready";

export interface WebWorkspaceReviewState {
  reviewed: boolean;
  warnings: string[];
}

export interface WebWorkspaceEntry {
  id: string;
  status: WebWorkspaceEntryStatus;
  manifest: ProfileManifest;
  review: WebWorkspaceReviewState;
  batchId?: string;
  file?: {
    name: string;
    text: string;
  };
}

export interface WebWorkspaceBatch {
  id: string;
  name: string;
  importedAt: string;
  entryIds: string[];
}

export interface WebProfilesWorkspace {
  createdAt: string;
  updatedAt: string;
  entries: WebWorkspaceEntry[];
  batches: WebWorkspaceBatch[];
}

export interface CreateWebProfilesWorkspaceOptions {
  baselineEntries?: WebWorkspaceEntry[];
  now?: string;
}

export interface BrowserLutUploadFile {
  name: string;
  text: string;
}

export interface AddLutUploadBatchOptions {
  batchName: string;
  namespace: string;
  files: BrowserLutUploadFile[];
  now?: string;
}

export interface WorkspaceCredentialInputs {
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  githubToken?: string;
}

export interface ExportPersistableWorkspaceOptions {
  includeDraftFileText?: boolean;
  credentials?: WorkspaceCredentialInputs;
}

export interface PersistedWebWorkspace {
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  entries: WebWorkspaceEntry[];
  batches: WebWorkspaceBatch[];
}

const DEFAULT_NOW = "1970-01-01T00:00:00.000Z";

function slugify(input: string, fallback = "profile") {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function stem(fileName: string) {
  const normalized = fileName.split(/[\\/]/).pop() ?? fileName;
  return normalized.replace(/\.[^.]*$/, "");
}

function titleFromStem(value: string) {
  return value
    .replace(/[_/\\.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function byteLength(text: string) {
  return new TextEncoder().encode(text).byteLength;
}

function parseTriple(value: string): [number, number, number] | undefined {
  const numbers = value
    .trim()
    .split(/\s+/)
    .map((part) => Number(part));
  if (numbers.length !== 3 || numbers.some((number) => !Number.isFinite(number))) {
    return undefined;
  }
  return [numbers[0]!, numbers[1]!, numbers[2]!];
}

function parseCubeMetadataText(text: string): CubeMetadata | undefined {
  const metadata: CubeMetadata = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const title = /^TITLE\s+"?([^"]+)"?/i.exec(line);
    if (title) {
      metadata.title = title[1]!.trim();
      continue;
    }

    const lut1d = /^LUT_1D_SIZE\s+(\d+)/i.exec(line);
    if (lut1d) {
      metadata.dimension = "1d";
      metadata.size = Number(lut1d[1]);
      continue;
    }

    const lut3d = /^LUT_3D_SIZE\s+(\d+)/i.exec(line);
    if (lut3d) {
      metadata.dimension = "3d";
      metadata.size = Number(lut3d[1]);
      continue;
    }

    const domainMin = /^DOMAIN_MIN\s+(.+)$/i.exec(line);
    if (domainMin) {
      metadata.domainMin = parseTriple(domainMin[1]!);
      continue;
    }

    const domainMax = /^DOMAIN_MAX\s+(.+)$/i.exec(line);
    if (domainMax) {
      metadata.domainMax = parseTriple(domainMax[1]!);
    }
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

async function sha256Hex(text: string) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto SHA-256 is unavailable.");
  }
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function uniqueEntryId(baseId: string, usedIds: Set<string>) {
  if (!usedIds.has(baseId)) {
    usedIds.add(baseId);
    return baseId;
  }

  for (let index = 2; ; index += 1) {
    const candidate = `${baseId}-${index}`;
    if (!usedIds.has(candidate)) {
      usedIds.add(candidate);
      return candidate;
    }
  }
}

function assetFileName(fileName: string) {
  return `${slugify(stem(fileName), "lut")}.cube`;
}

export function createWebProfilesWorkspace(
  options: CreateWebProfilesWorkspaceOptions = {},
): WebProfilesWorkspace {
  const now = options.now ?? DEFAULT_NOW;
  return {
    createdAt: now,
    updatedAt: now,
    entries: [...(options.baselineEntries ?? [])],
    batches: [],
  };
}

export async function addLutUploadBatch(
  workspace: WebProfilesWorkspace,
  options: AddLutUploadBatchOptions,
): Promise<WebProfilesWorkspace> {
  const now = options.now ?? DEFAULT_NOW;
  const usedIds = new Set(workspace.entries.map((entry) => entry.id));
  const batchId = slugify(`${options.batchName}-${workspace.batches.length + 1}`, "upload-batch");
  const newEntries: WebWorkspaceEntry[] = [];

  for (const file of options.files) {
    const fallbackTitle = titleFromStem(stem(file.name));
    const parsedMetadata = parseCubeMetadataText(file.text);
    const title = parsedMetadata?.title ?? fallbackTitle;
    const id = uniqueEntryId(`org.${slugify(options.namespace)}.lut.${slugify(title)}`, usedIds);
    const safeAssetName = assetFileName(file.name);
    const manifest: ProfileManifest = {
      schemaVersion: 1,
      id,
      kind: "lut",
      format: "cube",
      version: "1.0.0",
      title,
      description: null,
      license: "NOASSERTION",
      author: "Unknown",
      source: "local-import",
      sourceUrl: null,
      redistributionAllowed: false,
      targets: {},
      assets: [
        {
          role: "cube-lut",
          path: `assets/${safeAssetName}`,
          mediaType: "application/x-cube-lut",
          byteSize: byteLength(file.text),
          sha256: await sha256Hex(file.text),
        },
      ],
      createdAt: now,
      updatedAt: now,
      ...(parsedMetadata ? { lut: parsedMetadata } : {}),
    };

    newEntries.push({
      id,
      status: "new-draft",
      manifest,
      batchId,
      file,
      review: {
        reviewed: false,
        warnings: [
          "License and redistribution permission require review.",
          "LUT input/output contract requires review.",
        ],
      },
    });
  }

  return {
    ...workspace,
    updatedAt: now,
    entries: [...workspace.entries, ...newEntries],
    batches: [
      ...workspace.batches,
      {
        id: batchId,
        name: options.batchName,
        importedAt: now,
        entryIds: newEntries.map((entry) => entry.id),
      },
    ],
  };
}

export function exportPersistableWorkspace(
  workspace: WebProfilesWorkspace,
  options: ExportPersistableWorkspaceOptions = {},
): PersistedWebWorkspace {
  void options.credentials;
  return {
    schemaVersion: 1,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    batches: workspace.batches.map((batch) => ({ ...batch })),
    entries: workspace.entries.map((entry) => ({
      ...entry,
      manifest: { ...entry.manifest },
      review: { ...entry.review, warnings: [...entry.review.warnings] },
      file:
        options.includeDraftFileText && entry.file
          ? { ...entry.file }
          : undefined,
    })),
  };
}

export function restorePersistedWorkspace(
  persisted: PersistedWebWorkspace,
): WebProfilesWorkspace {
  return {
    createdAt: persisted.createdAt,
    updatedAt: persisted.updatedAt,
    batches: persisted.batches.map((batch) => ({ ...batch })),
    entries: persisted.entries.map((entry) => ({
      ...entry,
      manifest: { ...entry.manifest },
      review: { ...entry.review, warnings: [...entry.review.warnings] },
      file: entry.file ? { ...entry.file } : undefined,
    })),
  };
}
