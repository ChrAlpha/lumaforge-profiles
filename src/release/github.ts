import path from "node:path";

import { execa } from "execa";

import { fs } from "../utils/fs";

export interface GithubReleaseOptions {
  rootDir: string;
  tag: string;
  dryRun?: boolean;
  draft?: boolean;
  prerelease?: boolean;
  clobber?: boolean;
  runner?: (command: string, args: string[]) => Promise<void>;
}

export interface GithubReleasePlan {
  tag: string;
  outputDir: string;
  dryRun: boolean;
  commands: string[][];
  assets: string[];
}

export interface GithubReleaseResult extends GithubReleasePlan {}

async function releaseAssetPaths(outputDir: string) {
  const entries = await fs.readdir(outputDir);
  const assets = entries
    .filter((entry) => entry.endsWith(".zip") || entry === "release-manifest.json" || entry === "SHA256SUMS" || entry === "RELEASE_NOTES.md")
    .sort((a, b) => {
      const rank = (name: string) => (name.endsWith(".zip") ? 0 : name === "release-manifest.json" ? 1 : name === "SHA256SUMS" ? 2 : 3);
      return rank(a) - rank(b) || a.localeCompare(b);
    })
    .map((entry) => path.join(outputDir, entry));
  if (assets.length === 0) {
    throw new Error(`No release assets found in ${outputDir}. Run profiles pack first.`);
  }
  return assets;
}

export async function buildGithubReleasePlan(options: GithubReleaseOptions): Promise<GithubReleasePlan> {
  const outputDir = path.join(options.rootDir, "dist", "release", options.tag);
  const assets = await releaseAssetPaths(outputDir);
  const notesFile = path.join(outputDir, "RELEASE_NOTES.md");
  const createCommand = ["gh", "release", "create", options.tag, "--title", options.tag, "--notes-file", notesFile];
  if (options.draft) {
    createCommand.push("--draft");
  }
  if (options.prerelease) {
    createCommand.push("--prerelease");
  }

  const uploadCommand = ["gh", "release", "upload", options.tag, ...assets];
  if (options.clobber) {
    uploadCommand.push("--clobber");
  }

  return {
    tag: options.tag,
    outputDir,
    dryRun: options.dryRun ?? true,
    commands: [
      ["gh", "release", "view", options.tag],
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
    await runner("gh", ["release", "view", options.tag]);
  } catch {
    releaseExists = false;
  }

  if (!releaseExists) {
    await runner("gh", plan.commands[1]!.slice(1));
  }

  await runner("gh", plan.commands[2]!.slice(1));
  return plan;
}
