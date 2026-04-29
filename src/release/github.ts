import path from "node:path";

import { execa } from "execa";

import { fs } from "../utils/fs";
import { resolveGithubRepository } from "./build";

export interface GithubReleaseOptions {
  rootDir: string;
  tag: string;
  repo?: string;
  dryRun?: boolean;
  draft?: boolean;
  prerelease?: boolean;
  clobber?: boolean;
  runner?: (command: string, args: string[]) => Promise<void>;
}

export interface GithubReleasePlan {
  tag: string;
  repo: string;
  outputDir: string;
  indexPath: string;
  assetCount: number;
  totalBytes: number;
  dryRun: boolean;
  commands: string[][];
  assets: string[];
}

export interface GithubReleaseResult extends GithubReleasePlan {}

async function listFilesIfExists(directory: string) {
  if (!(await fs.pathExists(directory))) {
    return [];
  }
  const entries = await fs.readdir(directory);
  return entries.sort((a, b) => a.localeCompare(b)).map((entry) => path.join(directory, entry));
}

async function releaseAssetPaths(outputDir: string, tag: string) {
  const indexPath = path.join(outputDir, `lumaforge-profiles.${tag}.index.json`);
  const checksumsPath = path.join(outputDir, `lumaforge-profiles.${tag}.checksums.txt`);
  const required = [indexPath, checksumsPath];
  for (const filePath of required) {
    if (!(await fs.pathExists(filePath))) {
      throw new Error(`Missing release asset ${filePath}. Run profiles build-release first.`);
    }
  }
  const assets = [
    indexPath,
    checksumsPath,
    ...(await listFilesIfExists(path.join(outputDir, "assets"))),
    ...(await listFilesIfExists(path.join(outputDir, "entries")))
  ];
  const assetNames = new Map<string, string>();
  for (const assetPath of assets) {
    const name = path.basename(assetPath);
    const previous = assetNames.get(name);
    if (previous) {
      throw new Error(`Release asset basename collision: ${name} for ${previous} and ${assetPath}`);
    }
    assetNames.set(name, assetPath);
  }
  if (assets.length === 0) {
    throw new Error(`No release assets found in ${outputDir}. Run profiles build-release first.`);
  }
  return assets;
}

export async function buildGithubReleasePlan(options: GithubReleaseOptions): Promise<GithubReleasePlan> {
  const repo = resolveGithubRepository(options.repo);
  const outputDir = path.join(options.rootDir, "dist", "release", options.tag);
  const assets = await releaseAssetPaths(outputDir, options.tag);
  const notesFile = path.join(outputDir, "RELEASE_NOTES.md");
  const createCommand = [
    "gh",
    "release",
    "create",
    options.tag,
    "--title",
    options.tag,
    "--notes-file",
    notesFile,
    "--repo",
    repo.fullName
  ];
  if (options.draft) {
    createCommand.push("--draft");
  }
  if (options.prerelease) {
    createCommand.push("--prerelease");
  }

  const uploadCommand = ["gh", "release", "upload", options.tag, ...assets, "--repo", repo.fullName];
  if (options.clobber) {
    uploadCommand.push("--clobber");
  }
  const sizes = await Promise.all(assets.map(async (assetPath) => (await fs.stat(assetPath)).size));

  return {
    tag: options.tag,
    repo: repo.fullName,
    outputDir,
    indexPath: path.join(outputDir, `lumaforge-profiles.${options.tag}.index.json`),
    assetCount: assets.length,
    totalBytes: sizes.reduce((total, size) => total + size, 0),
    dryRun: options.dryRun ?? true,
    commands: [
      ["gh", "release", "view", options.tag, "--repo", repo.fullName],
      createCommand,
      uploadCommand
    ],
    assets
  };
}

async function defaultRunner(command: string, args: string[]) {
  await execa(command, args, { stdio: "inherit" });
}

export async function releaseProfiles(options: GithubReleaseOptions): Promise<GithubReleaseResult> {
  const dryRun = options.dryRun ?? true;
  const plan = await buildGithubReleasePlan({ ...options, dryRun });
  if (dryRun) {
    return plan;
  }

  const runner = options.runner ?? defaultRunner;
  await runner("gh", ["--version"]);
  await runner("gh", ["auth", "status"]);

  let releaseExists = true;
  try {
    await runner("gh", ["release", "view", options.tag, "--repo", plan.repo]);
  } catch {
    releaseExists = false;
  }

  if (!releaseExists) {
    await runner("gh", plan.commands[1]!.slice(1));
  }

  await runner("gh", plan.commands[2]!.slice(1));
  return plan;
}
