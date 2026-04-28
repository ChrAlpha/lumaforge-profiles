import path from "node:path";

import { discoverManifestPaths } from "./discover";
import { profileEntryManifestSchema } from "./schema";
import type { ProfileManifest, RepositoryManifest } from "./types";
import { readJsonIfExists, readJsonFile, writeJsonFile } from "../utils/fs";
import { nowIso } from "../utils/time";

export interface GenerateRepositoryIndexOptions {
  rootDir: string;
  now?: string;
}

export function defaultRepositoryManifest(generatedAt: string): RepositoryManifest {
  return {
    schemaVersion: 1,
    id: "org.lumaforge.profiles",
    title: "LumaForge Profiles",
    description: "Camera, lens, LUT, and look profiles for the LumaForge RAW pipeline.",
    entriesRoot: "profiles",
    defaultEntryGlob: "profiles/*/manifest.json",
    generatedAt,
    entries: []
  };
}

export async function generateRepositoryIndex(options: GenerateRepositoryIndexOptions): Promise<RepositoryManifest> {
  const generatedAt = options.now ?? nowIso();
  const indexPath = path.join(options.rootDir, "lumaforge-profiles.json");
  const existing = await readJsonIfExists<RepositoryManifest>(indexPath);
  const base: RepositoryManifest = {
    ...defaultRepositoryManifest(generatedAt),
    ...(existing ?? {}),
    schemaVersion: 1,
    entriesRoot: existing?.entriesRoot ?? "profiles",
    defaultEntryGlob: existing?.defaultEntryGlob ?? "profiles/*/manifest.json",
    generatedAt,
    entries: []
  };

  const manifestPaths = await discoverManifestPaths(options.rootDir, base.defaultEntryGlob);
  const entries: RepositoryManifest["entries"] = [];

  for (const manifestPath of manifestPaths) {
    const raw = await readJsonFile<unknown>(path.join(options.rootDir, manifestPath));
    const parsed = profileEntryManifestSchema.safeParse(raw);
    if (!parsed.success) {
      continue;
    }
    const manifest = parsed.data as ProfileManifest;
    entries.push({
      id: manifest.id,
      kind: manifest.kind,
      version: manifest.version,
      title: manifest.title,
      manifest: manifestPath
    });
  }

  entries.sort((a, b) => a.id.localeCompare(b.id) || a.manifest.localeCompare(b.manifest));
  const index: RepositoryManifest = {
    ...base,
    entries
  };
  await writeJsonFile(indexPath, index);
  return index;
}

export function entriesByKind(entries: RepositoryManifest["entries"]) {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.kind] = (counts[entry.kind] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}
