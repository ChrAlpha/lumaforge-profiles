import path from "node:path";

import { generateRepositoryIndex } from "../manifest";
import { formatValidationIssue, validateProfiles } from "../manifest/validate";
import type { ProfileAsset, ProfileManifest, ReleaseIndex, ReleaseIndexAsset, ReleaseIndexEntry } from "../manifest/types";
import { fileByteSize, fs, isSafeRelativePosixPath, toPosixPath, writeJsonFile } from "../utils/fs";
import { sha256File } from "../utils/hash";
import { nowIso } from "../utils/time";

export interface BuildReleaseProfilesOptions {
  rootDir: string;
  tag: string;
  repo?: string;
  now?: string;
}

export interface BuiltReleaseAsset {
  entryId: string;
  role: string;
  mediaType: string;
  originalPath: string;
  sourcePath: string;
  outputPath: string;
  releaseAssetName: string;
  size: number;
  sha256: string;
}

export interface BuiltEntryManifest {
  entryId: string;
  originalPath: string;
  outputPath: string;
  releaseAssetName: string;
}

export interface BuildReleaseProfilesResult {
  outputDir: string;
  indexPath: string;
  checksumsPath: string;
  releaseAssets: BuiltReleaseAsset[];
  entryManifests: BuiltEntryManifest[];
  totalBytes: number;
  index: ReleaseIndex;
}

export interface GithubRepositoryParts {
  owner: string;
  repo: string;
  fullName: string;
}

interface ChecksumTarget {
  filePath: string;
  relativePath: string;
}

const DEFAULT_GITHUB_REPOSITORY = "lumaforge/lumaforge-profiles";

export function resolveGithubRepository(repo?: string): GithubRepositoryParts {
  const value = (repo ?? process.env.GITHUB_REPOSITORY ?? DEFAULT_GITHUB_REPOSITORY).trim();
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(value);
  if (!match) {
    throw new Error(`GitHub repository must be in owner/name form, found: ${value}`);
  }
  return {
    owner: match[1]!,
    repo: match[2]!,
    fullName: `${match[1]!}/${match[2]!}`
  };
}

function releaseSafeName(value: string, fallback: string) {
  const safe = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  const result = safe || fallback;
  if (result.includes("/") || result === "." || result === "..") {
    throw new Error(`Unsafe release asset name segment: ${value}`);
  }
  return result;
}

function entrySafeName(entryDir: string) {
  return releaseSafeName(path.posix.basename(entryDir), "entry");
}

function assetExtension(assetPath: string) {
  return path.posix.extname(assetPath).toLowerCase();
}

function releaseAssetName(params: {
  entryDir: string;
  asset: ProfileAsset;
  assetCount: number;
}) {
  const entryName = entrySafeName(params.entryDir);
  const extension = assetExtension(params.asset.path);
  if (params.assetCount === 1) {
    return `asset.${entryName}${extension}`;
  }
  const role = releaseSafeName(params.asset.role, "asset");
  const shortHash = params.asset.sha256.slice(0, 8).toLowerCase();
  return `asset.${entryName}.${role}.${shortHash}${extension}`;
}

function entryManifestAssetName(entryDir: string) {
  return `entry.${entrySafeName(entryDir)}.manifest.json`;
}

function githubDownloadUrl(repo: GithubRepositoryParts, tag: string, releaseAssetNameValue: string) {
  return `https://github.com/${repo.owner}/${repo.repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(
    releaseAssetNameValue
  )}`;
}

function assertUniqueReleaseName(usedNames: Map<string, string>, releaseAssetNameValue: string, source: string) {
  if (releaseAssetNameValue.includes("/")) {
    throw new Error(`Release asset name must not contain slash: ${releaseAssetNameValue}`);
  }
  const previous = usedNames.get(releaseAssetNameValue);
  if (previous) {
    throw new Error(`Release asset name collision: ${releaseAssetNameValue} for ${previous} and ${source}`);
  }
  usedNames.set(releaseAssetNameValue, source);
}

async function checksumLine(target: ChecksumTarget) {
  return {
    relativePath: target.relativePath,
    sha256: await sha256File(target.filePath)
  };
}

function releaseIndexEntry(params: {
  manifest: ProfileManifest;
  manifestPath: string;
  manifestReleaseAssetName: string;
  assets: ReleaseIndexAsset[];
}): ReleaseIndexEntry {
  const { assets: _assets, ...manifestFields } = params.manifest;
  return {
    ...manifestFields,
    manifest: {
      originalPath: params.manifestPath,
      releaseAssetName: params.manifestReleaseAssetName
    },
    assets: params.assets
  };
}

export async function buildReleaseProfiles(options: BuildReleaseProfilesOptions): Promise<BuildReleaseProfilesResult> {
  const generatedAt = options.now ?? nowIso();
  const githubRepo = resolveGithubRepository(options.repo);
  const validation = await validateProfiles({ rootDir: options.rootDir, release: true });
  if (validation.errors.length > 0) {
    throw new Error(validation.errors.map(formatValidationIssue).join("\n"));
  }

  const repository = await generateRepositoryIndex({ rootDir: options.rootDir, now: generatedAt });
  const manifestsByPath = new Map(validation.manifests.map((item) => [item.manifestPath, item]));
  const outputDir = path.join(options.rootDir, "dist", "release", options.tag);
  const assetsDir = path.join(outputDir, "assets");
  const entriesDir = path.join(outputDir, "entries");
  await fs.emptyDir(outputDir);
  await fs.ensureDir(assetsDir);
  await fs.ensureDir(entriesDir);

  const usedReleaseNames = new Map<string, string>();
  const releaseAssets: BuiltReleaseAsset[] = [];
  const entryManifests: BuiltEntryManifest[] = [];
  const indexEntries: ReleaseIndexEntry[] = [];
  const checksumTargets: ChecksumTarget[] = [];

  for (const entry of repository.entries) {
    const discovered = manifestsByPath.get(entry.manifest);
    if (!discovered) {
      throw new Error(`Validated manifest is missing from release build: ${entry.manifest}`);
    }

    const manifest = discovered.manifest;
    const manifestReleaseAssetName = entryManifestAssetName(discovered.entryDir);
    assertUniqueReleaseName(usedReleaseNames, manifestReleaseAssetName, entry.manifest);
    const manifestOutputPath = path.join(entriesDir, manifestReleaseAssetName);
    await fs.copy(discovered.absolutePath, manifestOutputPath, { overwrite: false });
    const builtEntryManifest: BuiltEntryManifest = {
      entryId: manifest.id,
      originalPath: entry.manifest,
      outputPath: manifestOutputPath,
      releaseAssetName: manifestReleaseAssetName
    };
    entryManifests.push(builtEntryManifest);
    checksumTargets.push({
      filePath: manifestOutputPath,
      relativePath: toPosixPath(path.posix.join("entries", manifestReleaseAssetName))
    });

    const indexAssets: ReleaseIndexAsset[] = [];
    for (const asset of manifest.assets) {
      if (!isSafeRelativePosixPath(asset.path)) {
        throw new Error(`Unsafe asset path in ${entry.manifest}: ${asset.path}`);
      }
      const normalizedAssetPath = path.posix.normalize(asset.path);
      const assetSourcePath = path.join(options.rootDir, discovered.entryDir, normalizedAssetPath);
      const size = await fileByteSize(assetSourcePath);
      const sha256 = await sha256File(assetSourcePath);
      const name = releaseAssetName({
        entryDir: discovered.entryDir,
        asset,
        assetCount: manifest.assets.length
      });
      assertUniqueReleaseName(usedReleaseNames, name, `${entry.manifest}:${asset.path}`);
      const outputPath = path.join(assetsDir, name);
      await fs.copy(assetSourcePath, outputPath, { overwrite: false });

      const builtAsset: BuiltReleaseAsset = {
        entryId: manifest.id,
        role: asset.role,
        mediaType: asset.mediaType,
        originalPath: asset.path,
        sourcePath: assetSourcePath,
        outputPath,
        releaseAssetName: name,
        size,
        sha256
      };
      releaseAssets.push(builtAsset);
      checksumTargets.push({
        filePath: outputPath,
        relativePath: toPosixPath(path.posix.join("assets", name))
      });
      indexAssets.push({
        role: asset.role,
        mediaType: asset.mediaType,
        originalPath: asset.path,
        releaseAssetName: name,
        size,
        sha256,
        download: {
          type: "github-release-asset",
          url: githubDownloadUrl(githubRepo, options.tag, name)
        }
      });
    }

    indexEntries.push(
      releaseIndexEntry({
        manifest,
        manifestPath: entry.manifest,
        manifestReleaseAssetName,
        assets: indexAssets
      })
    );
  }

  const index: ReleaseIndex = {
    schemaVersion: 1,
    id: repository.id,
    title: repository.title,
    description: repository.description,
    version: options.tag,
    generatedAt,
    release: {
      provider: "github",
      owner: githubRepo.owner,
      repo: githubRepo.repo,
      tag: options.tag
    },
    entries: indexEntries
  };
  const indexFileName = `lumaforge-profiles.${options.tag}.index.json`;
  assertUniqueReleaseName(usedReleaseNames, indexFileName, "release index");
  const indexPath = path.join(outputDir, indexFileName);
  await writeJsonFile(indexPath, index);
  checksumTargets.push({
    filePath: indexPath,
    relativePath: indexFileName
  });

  const checksums = await Promise.all(checksumTargets.map((target) => checksumLine(target)));
  const checksumsText = `${checksums
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    .map((entry) => `${entry.sha256}  ${entry.relativePath}`)
    .join("\n")}\n`;
  const checksumsFileName = `lumaforge-profiles.${options.tag}.checksums.txt`;
  assertUniqueReleaseName(usedReleaseNames, checksumsFileName, "release checksums");
  const checksumsPath = path.join(outputDir, checksumsFileName);
  await fs.writeFile(checksumsPath, checksumsText);

  await fs.writeFile(
    path.join(outputDir, "RELEASE_NOTES.md"),
    [
      `# ${options.tag}`,
      "",
      `Generated at: ${generatedAt}`,
      "",
      `Entries: ${indexEntries.length}`,
      `Runtime assets: ${releaseAssets.length}`,
      "",
      "GitHub Releases are used as an asset store. Each runtime asset is uploaded as an individual release asset.",
      "Bulk archives are not part of the default runtime loading path."
    ].join("\n") + "\n"
  );

  const uploadTargets = [
    ...releaseAssets.map((asset) => asset.outputPath),
    ...entryManifests.map((manifest) => manifest.outputPath),
    indexPath,
    checksumsPath
  ];
  const totalBytes = (
    await Promise.all(uploadTargets.map(async (filePath) => (await fs.stat(filePath)).size))
  ).reduce((total, size) => total + size, 0);

  return {
    outputDir,
    indexPath,
    checksumsPath,
    releaseAssets,
    entryManifests,
    totalBytes,
    index
  };
}
