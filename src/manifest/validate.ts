import path from "node:path";

import { discoverManifestPaths } from "./discover";
import { formatZodError, profileEntryManifestSchema } from "./schema";
import {
  FORMAT_BY_KIND,
  MEDIA_TYPE_BY_EXTENSION,
  PRIMARY_ROLE_BY_KIND_AND_FORMAT,
  type ProfileManifest,
} from "./types";
import {
  fileByteSize,
  fs,
  isSafeRelativePosixPath,
  readJsonFile,
  toPosixPath,
} from "../utils/fs";
import { sha256File } from "../utils/hash";

export interface ValidationIssue {
  code: string;
  message: string;
  manifestPath?: string;
  entryId?: string;
  field?: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  manifests: Array<{
    manifestPath: string;
    absolutePath: string;
    entryDir: string;
    manifest: ProfileManifest;
  }>;
}

export interface ValidateProfilesOptions {
  rootDir: string;
  release?: boolean;
}

function issue(
  code: string,
  message: string,
  manifestPath?: string,
  entryId?: string,
  field?: string,
): ValidationIssue {
  return { code, message, manifestPath, entryId, field };
}

function addReleaseIssue(
  result: ValidationResult,
  release: boolean,
  validationIssue: ValidationIssue,
) {
  if (release) {
    result.errors.push(validationIssue);
  } else {
    result.warnings.push(validationIssue);
  }
}

function normalizedAssetPath(assetPath: string) {
  return path.posix.normalize(assetPath);
}

function isValidProfileVersion(version: string) {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version);
}

function missingLutContractFields(manifest: ProfileManifest) {
  const contractFields = [
    "inputTransfer",
    "inputGamut",
    "outputTransfer",
    "outputGamut",
  ] as const;
  const present = contractFields.filter((field) =>
    Boolean(manifest.lut?.[field]),
  );
  if (present.length === 0 || present.length === contractFields.length) {
    return [];
  }
  return contractFields.filter((field) => !manifest.lut?.[field]);
}

function primaryRoleForManifest(manifest: ProfileManifest) {
  return PRIMARY_ROLE_BY_KIND_AND_FORMAT[
    `${manifest.kind}:${String(manifest.format)}`
  ];
}

export function formatValidationIssue(validationIssue: ValidationIssue) {
  const where = [
    validationIssue.entryId,
    validationIssue.manifestPath,
    validationIssue.field,
  ]
    .filter(Boolean)
    .join(" ");
  return `[${validationIssue.code}]${where ? ` ${where}` : ""}: ${validationIssue.message}`;
}

export async function validateProfiles(
  options: ValidateProfilesOptions,
): Promise<ValidationResult> {
  const result: ValidationResult = {
    errors: [],
    warnings: [],
    manifests: [],
  };
  const manifestPaths = await discoverManifestPaths(options.rootDir);
  const ids = new Map<string, string>();
  const seenManifestPaths = new Set<string>();

  for (const manifestPath of manifestPaths) {
    if (seenManifestPaths.has(manifestPath)) {
      result.errors.push(
        issue(
          "duplicate-manifest-path",
          "Manifest path is listed more than once.",
          manifestPath,
        ),
      );
      continue;
    }
    seenManifestPaths.add(manifestPath);

    const absolutePath = path.join(options.rootDir, manifestPath);
    let raw: unknown;
    try {
      raw = await readJsonFile<unknown>(absolutePath);
    } catch (error) {
      result.errors.push(
        issue(
          "json",
          error instanceof Error ? error.message : "Unable to read JSON.",
          manifestPath,
        ),
      );
      continue;
    }

    const parsed = profileEntryManifestSchema.safeParse(raw);
    if (!parsed.success) {
      result.errors.push(
        issue("schema", formatZodError(parsed.error), manifestPath),
      );
      continue;
    }

    const manifest = parsed.data as ProfileManifest;
    if (!isValidProfileVersion(manifest.version)) {
      result.errors.push(
        issue(
          "version",
          `Profile version must be semantic version-like, found ${manifest.version}.`,
          manifestPath,
          manifest.id,
          "version",
        ),
      );
    }

    const previousPath = ids.get(manifest.id);
    if (previousPath) {
      result.errors.push(
        issue(
          "duplicate-id",
          `Entry id duplicates ${previousPath}.`,
          manifestPath,
          manifest.id,
          "id",
        ),
      );
    } else {
      ids.set(manifest.id, manifestPath);
    }

    const allowedFormats = FORMAT_BY_KIND[manifest.kind];
    if (
      allowedFormats.length > 0 &&
      !allowedFormats.includes(String(manifest.format))
    ) {
      result.errors.push(
        issue(
          "kind-format",
          `kind ${manifest.kind} does not support format ${String(manifest.format)}.`,
          manifestPath,
          manifest.id,
          "format",
        ),
      );
    }

    const missingContractFields = missingLutContractFields(manifest);
    if (missingContractFields.length > 0) {
      result.errors.push(
        issue(
          "lut-contract",
          `LUT contract fields must be complete when any input/output contract field is present; missing ${missingContractFields.join(", ")}.`,
          manifestPath,
          manifest.id,
          "lut",
        ),
      );
    }

    const expectedRole = primaryRoleForManifest(manifest);
    const primaryAssets = expectedRole
      ? manifest.assets.filter((asset) => asset.role === expectedRole)
      : [];
    if (expectedRole && primaryAssets.length !== 1) {
      result.errors.push(
        issue(
          "kind-role",
          `kind ${manifest.kind} with format ${String(manifest.format)} requires exactly one primary asset with role ${expectedRole}.`,
          manifestPath,
          manifest.id,
          "assets.role",
        ),
      );
    }

    for (const asset of manifest.assets) {
      if (!isSafeRelativePosixPath(asset.path)) {
        result.errors.push(
          issue(
            "asset-path",
            `Asset path ${asset.path} escapes the entry directory.`,
            manifestPath,
            manifest.id,
            "assets.path",
          ),
        );
        continue;
      }

      const assetPath = normalizedAssetPath(asset.path);
      const expectedMediaType =
        MEDIA_TYPE_BY_EXTENSION[path.posix.extname(assetPath).toLowerCase()];
      if (expectedMediaType && asset.mediaType !== expectedMediaType) {
        result.errors.push(
          issue(
            "asset-media-type",
            `Asset ${asset.path} expects mediaType ${expectedMediaType}.`,
            manifestPath,
            manifest.id,
            "assets.mediaType",
          ),
        );
      }

      const absoluteAssetPath = path.join(
        options.rootDir,
        path.dirname(manifestPath),
        assetPath,
      );
      if (!(await fs.pathExists(absoluteAssetPath))) {
        result.errors.push(
          issue(
            "asset-missing",
            `Asset file does not exist: ${asset.path}.`,
            manifestPath,
            manifest.id,
            "assets.path",
          ),
        );
        continue;
      }

      const actualByteSize = await fileByteSize(absoluteAssetPath);
      if (actualByteSize <= 0 || asset.byteSize <= 0) {
        result.errors.push(
          issue(
            "asset-empty",
            `Asset file must be larger than zero bytes: ${asset.path}.`,
            manifestPath,
            manifest.id,
            "assets.byteSize",
          ),
        );
      }
      if (actualByteSize !== asset.byteSize) {
        result.errors.push(
          issue(
            "asset-byte-size",
            `Expected ${asset.byteSize} bytes but found ${actualByteSize}.`,
            manifestPath,
            manifest.id,
            "assets.byteSize",
          ),
        );
      }

      const actualHash = await sha256File(absoluteAssetPath);
      if (actualHash !== asset.sha256.toLowerCase()) {
        result.errors.push(
          issue(
            "asset-sha256",
            `Expected sha256 ${asset.sha256} but found ${actualHash}.`,
            manifestPath,
            manifest.id,
            "assets.sha256",
          ),
        );
      }

      if (!asset.sha256) {
        addReleaseIssue(
          result,
          Boolean(options.release),
          issue(
            "release-asset-sha256",
            "Asset sha256 is required for release.",
            manifestPath,
            manifest.id,
            "assets.sha256",
          ),
        );
      }
    }

    const normalizedLicense = manifest.license.trim().toUpperCase();
    if (manifest.redistributionAllowed !== true) {
      addReleaseIssue(
        result,
        Boolean(options.release),
        issue(
          "release-redistribution",
          "redistributionAllowed must be true for release.",
          manifestPath,
          manifest.id,
          "redistributionAllowed",
        ),
      );
    }
    if (
      !manifest.license.trim() ||
      normalizedLicense === "NOASSERTION" ||
      normalizedLicense === "UNLICENSED"
    ) {
      addReleaseIssue(
        result,
        Boolean(options.release),
        issue(
          "release-license",
          "A redistributable release requires an explicit non-NOASSERTION license.",
          manifestPath,
          manifest.id,
          "license",
        ),
      );
    }
    if (!manifest.author.trim()) {
      addReleaseIssue(
        result,
        Boolean(options.release),
        issue(
          "release-author",
          "author is required for release.",
          manifestPath,
          manifest.id,
          "author",
        ),
      );
    }
    if (!manifest.source.trim()) {
      addReleaseIssue(
        result,
        Boolean(options.release),
        issue(
          "release-source",
          "source is required for release.",
          manifestPath,
          manifest.id,
          "source",
        ),
      );
    }

    result.manifests.push({
      manifestPath,
      absolutePath,
      entryDir: toPosixPath(path.dirname(manifestPath)),
      manifest,
    });
  }

  return result;
}
