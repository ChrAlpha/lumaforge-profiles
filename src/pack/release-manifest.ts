import type { ProfileManifest, ReleaseManifest, ReleaseManifestPack, RepositoryManifest } from "../manifest/types";

export function countEntriesByKind(manifests: ProfileManifest[]) {
  const counts: Record<string, number> = {};
  for (const manifest of manifests) {
    counts[manifest.kind] = (counts[manifest.kind] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export function createReleaseManifest(params: {
  tag: string;
  generatedAt: string;
  manifests: ProfileManifest[];
  packs: ReleaseManifestPack[];
}): ReleaseManifest {
  return {
    schemaVersion: 1,
    id: "org.lumaforge.profiles.release",
    tag: params.tag,
    generatedAt: params.generatedAt,
    totalEntries: params.manifests.length,
    entriesByKind: countEntriesByKind(params.manifests),
    packs: params.packs
  };
}

export function licenseSummary(manifests: ProfileManifest[]) {
  const counts: Record<string, number> = {};
  for (const manifest of manifests) {
    counts[manifest.license] = (counts[manifest.license] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export function createReleaseNotes(params: {
  tag: string;
  generatedAt: string;
  repository: RepositoryManifest;
  manifests: ProfileManifest[];
  packs: ReleaseManifestPack[];
}) {
  const entriesByKind = countEntriesByKind(params.manifests);
  const licenses = licenseSummary(params.manifests);
  const lines = [
    `# ${params.tag}`,
    "",
    `Generated at: ${params.generatedAt}`,
    "",
    `Total entries: ${params.repository.entries.length}`,
    "",
    "## Entries by kind",
    "",
    ...Object.entries(entriesByKind).map(([kind, count]) => `- ${kind}: ${count}`),
    "",
    "## Packs",
    "",
    ...params.packs.map(
      (pack) =>
        `- ${pack.fileName}: ${pack.entryCount} entries, ${pack.assetCount} assets, sha256 ${pack.sha256}`
    ),
    "",
    "## License summary",
    "",
    ...Object.entries(licenses).map(([license, count]) => `- ${license}: ${count}`),
    "",
    "Only assets with redistributionAllowed=true are included."
  ];
  return `${lines.join("\n")}\n`;
}
