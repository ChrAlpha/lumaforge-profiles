import path from "node:path";

import fg from "fast-glob";

import { readJsonFile, toPosixPath } from "../utils/fs";
import type { ProfileManifest } from "./types";

export interface DiscoveredManifest {
  manifestPath: string;
  absolutePath: string;
  entryDir: string;
  manifest: unknown;
}

export async function discoverManifestPaths(rootDir: string, glob = "profiles/*/manifest.json") {
  const entries = await fg([glob], {
    cwd: rootDir,
    onlyFiles: true,
    absolute: false,
    dot: false,
    unique: true
  });
  return entries.map((entry) => toPosixPath(entry)).sort((a, b) => a.localeCompare(b));
}

export async function discoverManifests(rootDir: string, glob = "profiles/*/manifest.json"): Promise<DiscoveredManifest[]> {
  const paths = await discoverManifestPaths(rootDir, glob);
  const results: DiscoveredManifest[] = [];
  for (const manifestPath of paths) {
    const absolutePath = path.join(rootDir, manifestPath);
    results.push({
      manifestPath,
      absolutePath,
      entryDir: toPosixPath(path.posix.dirname(manifestPath)),
      manifest: await readJsonFile<ProfileManifest>(absolutePath)
    });
  }
  return results;
}
