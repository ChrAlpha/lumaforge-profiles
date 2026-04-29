import type { ObjectStore } from "./object-store";

export interface PlanR2GcOptions {
  store: Pick<ObjectStore, "listObjects" | "getJson" | "deleteObjects">;
  keepReleases?: number;
  keepTags?: string[];
  channelNames?: string[];
}

export interface RunR2GcOptions extends PlanR2GcOptions {
  dryRun?: boolean;
}

export interface R2GcPlan {
  keepTags: string[];
  releaseTagsToDelete: string[];
  deleteKeys: string[];
  deleteBytes: number;
  estimatedClassAOperations: number;
  estimatedClassBOperations: number;
}

function releaseTagFromKey(key: string) {
  const match = /^releases\/([^/]+)\//.exec(key);
  return match?.[1] ?? null;
}

export async function planR2Gc(options: PlanR2GcOptions): Promise<R2GcPlan> {
  const keepCount = Math.max(0, options.keepReleases ?? 0);
  const explicitKeepTags = new Set(
    (options.keepTags ?? []).map((value) => value.trim()).filter(Boolean),
  );
  const channelNames = [
    ...new Set(
      (options.channelNames ?? ["stable", "latest"])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];

  const releaseObjects = await options.store.listObjects("releases/");
  const blobObjects = await options.store.listObjects("blobs/sha256/");
  const releaseTags = [
    ...new Set(
      releaseObjects
        .map((object) => releaseTagFromKey(object.key))
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  let classBOperations = 2;
  for (const channel of channelNames) {
    const metadata = await options.store.getJson<{ tag?: string }>(
      `channels/${channel}/release.json`,
    );
    classBOperations += 1;
    if (metadata?.tag) {
      explicitKeepTags.add(metadata.tag);
    }
  }

  const releaseMetadata = await Promise.all(
    releaseTags.map(async (tag) => {
      const metadata = await options.store.getJson<{
        tag?: string;
        createdAt?: string;
      }>(`releases/${tag}/release.json`);
      classBOperations += 1;
      return {
        tag,
        createdAt: metadata?.createdAt ?? "",
      };
    }),
  );
  releaseMetadata.sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || b.tag.localeCompare(a.tag),
  );
  for (const item of releaseMetadata.slice(0, keepCount)) {
    explicitKeepTags.add(item.tag);
  }

  const referencedBlobKeys = new Set<string>();
  for (const tag of explicitKeepTags) {
    const blobsManifest = await options.store.getJson<{
      blobs?: Array<{ key?: string }>;
    }>(`releases/${tag}/blobs-manifest.json`);
    classBOperations += 1;
    for (const blob of blobsManifest?.blobs ?? []) {
      if (blob.key) {
        referencedBlobKeys.add(blob.key);
      }
    }
  }

  const releaseTagsToDelete = releaseTags
    .filter((tag) => !explicitKeepTags.has(tag))
    .sort();
  const releaseKeysToDelete = releaseObjects
    .filter((object) => {
      const tag = releaseTagFromKey(object.key);
      return Boolean(tag && releaseTagsToDelete.includes(tag));
    })
    .map((object) => object.key);
  const blobKeysToDelete = blobObjects
    .filter((object) => !referencedBlobKeys.has(object.key))
    .map((object) => object.key);
  const deleteKeys = [...releaseKeysToDelete, ...blobKeysToDelete].sort();
  const sizeByKey = new Map(
    [...releaseObjects, ...blobObjects].map((object) => [
      object.key,
      object.size,
    ]),
  );

  return {
    keepTags: [...explicitKeepTags].sort(),
    releaseTagsToDelete,
    deleteKeys,
    deleteBytes: deleteKeys.reduce(
      (total, key) => total + (sizeByKey.get(key) ?? 0),
      0,
    ),
    estimatedClassAOperations: deleteKeys.length,
    estimatedClassBOperations: classBOperations,
  };
}

export async function runR2Gc(
  options: RunR2GcOptions,
): Promise<R2GcPlan & { dryRun: boolean }> {
  const plan = await planR2Gc(options);
  const dryRun = options.dryRun ?? true;
  if (!dryRun && plan.deleteKeys.length > 0) {
    await options.store.deleteObjects(plan.deleteKeys);
  }
  return {
    ...plan,
    dryRun,
  };
}
