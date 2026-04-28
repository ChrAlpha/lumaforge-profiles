import { createWriteStream } from "node:fs";
import path from "node:path";

import archiver from "archiver";

import { generateRepositoryIndex } from "../manifest";
import { formatValidationIssue, validateProfiles } from "../manifest/validate";
import {
  type ProfileKind,
  type ProfileManifest,
  type ReleaseManifestPack,
  type ReleasePackManifest,
  type RepositoryManifest
} from "../manifest/types";
import { fileByteSize, fs, readJsonFile, toPosixPath, writeJsonFile } from "../utils/fs";
import { sha256File } from "../utils/hash";
import { nowIso } from "../utils/time";
import { checksumFile, formatSha256Sums } from "./checksums";
import { createReleaseManifest, createReleaseNotes } from "./release-manifest";

export type PackName = "all" | "luts" | "dcp" | "lcp";

export interface PackProfilesOptions {
  rootDir: string;
  tag: string;
  packs?: PackName[];
  now?: string;
}

export interface PackProfilesResult {
  outputDir: string;
  packs: ReleaseManifestPack[];
}

const packKindFilters: Record<PackName, ProfileKind[]> = {
  all: [],
  luts: ["lut"],
  dcp: ["camera-profile"],
  lcp: ["lens-correction-profile"]
};

function packId(packName: PackName) {
  return `org.lumaforge.profiles.pack.${packName}`;
}

function zipFileName(tag: string, packName: PackName) {
  return `lumaforge-profiles-${tag}-${packName}.zip`;
}

function selectedEntries(repository: RepositoryManifest, manifestsByPath: Map<string, ProfileManifest>, packName: PackName) {
  const filters = packKindFilters[packName];
  return repository.entries.filter((entry) => filters.length === 0 || filters.includes(entry.kind)).map((entry) => ({
    entry,
    manifest: manifestsByPath.get(entry.manifest)!
  }));
}

async function appendFileWithSize(
  archive: archiver.Archiver,
  absolutePath: string,
  archivePath: string,
  uncompressedBytes: { value: number }
) {
  archive.file(absolutePath, { name: archivePath });
  uncompressedBytes.value += await fileByteSize(absolutePath);
}

async function createZip(params: {
  rootDir: string;
  tag: string;
  packName: PackName;
  repository: RepositoryManifest;
  selected: ReturnType<typeof selectedEntries>;
  outputPath: string;
  generatedAt: string;
}) {
  await fs.ensureDir(path.dirname(params.outputPath));
  const output = createWriteStream(params.outputPath);
  const archive = archiver("zip", { zlib: { level: 9 } });
  const uncompressedBytes = { value: 0 };

  const packRepository: RepositoryManifest = {
    ...params.repository,
    entries: params.selected.map(({ entry }) => entry)
  };
  const repositoryJson = `${JSON.stringify(packRepository, null, 2)}\n`;
  archive.append(repositoryJson, { name: "lumaforge-profiles.json" });
  uncompressedBytes.value += Buffer.byteLength(repositoryJson);

  const packManifest: ReleasePackManifest = {
    schemaVersion: 1,
    id: packId(params.packName),
    tag: params.tag,
    kindFilter: packKindFilters[params.packName],
    entryCount: params.selected.length,
    assetCount: params.selected.reduce((total, item) => total + item.manifest.assets.length, 0),
    uncompressedBytes: 0,
    generatedAt: params.generatedAt,
    entries: params.selected.map(({ entry }) => ({
      id: entry.id,
      manifest: entry.manifest
    }))
  };

  for (const { entry, manifest } of params.selected) {
    const manifestAbsolutePath = path.join(params.rootDir, entry.manifest);
    await appendFileWithSize(archive, manifestAbsolutePath, entry.manifest, uncompressedBytes);
    const entryDir = path.posix.dirname(entry.manifest);
    for (const asset of manifest.assets) {
      await appendFileWithSize(
        archive,
        path.join(params.rootDir, entryDir, asset.path),
        toPosixPath(path.posix.join(entryDir, asset.path)),
        uncompressedBytes
      );
    }
    for (const optionalFile of ["LICENSE", "NOTICE.md"]) {
      const optionalPath = path.join(params.rootDir, entryDir, optionalFile);
      if (await fs.pathExists(optionalPath)) {
        await appendFileWithSize(archive, optionalPath, toPosixPath(path.posix.join(entryDir, optionalFile)), uncompressedBytes);
      }
    }
  }

  packManifest.uncompressedBytes = uncompressedBytes.value;
  const packManifestJson = `${JSON.stringify(packManifest, null, 2)}\n`;
  archive.append(packManifestJson, { name: "pack-manifest.json" });

  await new Promise<void>((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.finalize().catch(reject);
  });
}

export async function packProfiles(options: PackProfilesOptions): Promise<PackProfilesResult> {
  const generatedAt = options.now ?? nowIso();
  const validation = await validateProfiles({ rootDir: options.rootDir, release: true });
  if (validation.errors.length > 0) {
    throw new Error(validation.errors.map(formatValidationIssue).join("\n"));
  }

  const repository = await generateRepositoryIndex({ rootDir: options.rootDir, now: generatedAt });
  const manifestsByPath = new Map<string, ProfileManifest>();
  for (const entry of repository.entries) {
    manifestsByPath.set(entry.manifest, await readJsonFile<ProfileManifest>(path.join(options.rootDir, entry.manifest)));
  }

  const outputDir = path.join(options.rootDir, "dist", "release", options.tag);
  await fs.emptyDir(outputDir);

  const packNames = options.packs ?? ["all", "luts", "dcp", "lcp"];
  const releasePacks: ReleaseManifestPack[] = [];
  const checksumTargets: string[] = [];

  for (const packName of packNames) {
    const selected = selectedEntries(repository, manifestsByPath, packName);
    const fileName = zipFileName(options.tag, packName);
    const outputPath = path.join(outputDir, fileName);
    await createZip({
      rootDir: options.rootDir,
      tag: options.tag,
      packName,
      repository,
      selected,
      outputPath,
      generatedAt
    });
    const zipSize = await fileByteSize(outputPath);
    const zipHash = await sha256File(outputPath);
    const pack: ReleaseManifestPack = {
      fileName,
      mediaType: "application/zip",
      byteSize: zipSize,
      sha256: zipHash,
      entryCount: selected.length,
      assetCount: selected.reduce((total, item) => total + item.manifest.assets.length, 0),
      kindFilter: packKindFilters[packName]
    };
    releasePacks.push(pack);
    checksumTargets.push(outputPath);
  }

  const manifests = [...manifestsByPath.values()].sort((a, b) => a.id.localeCompare(b.id));
  const releaseManifest = createReleaseManifest({
    tag: options.tag,
    generatedAt,
    manifests,
    packs: releasePacks
  });
  const releaseManifestPath = path.join(outputDir, "release-manifest.json");
  await writeJsonFile(releaseManifestPath, releaseManifest);
  checksumTargets.push(releaseManifestPath);

  const checksums = await Promise.all(checksumTargets.map((target) => checksumFile(target)));
  await fs.writeFile(path.join(outputDir, "SHA256SUMS"), formatSha256Sums(checksums));
  await fs.writeFile(
    path.join(outputDir, "RELEASE_NOTES.md"),
    createReleaseNotes({
      tag: options.tag,
      generatedAt,
      repository,
      manifests,
      packs: releasePacks
    })
  );

  return {
    outputDir,
    packs: releasePacks
  };
}
