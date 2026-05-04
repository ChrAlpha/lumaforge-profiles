import { planS3Gc, runS3Gc } from "../src/release/s3-gc";

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function createGcStore(seed: Record<string, string>) {
  const objects = new Map(
    Object.entries(seed).map(([key, body]) => [
      key,
      { body, size: Buffer.byteLength(body) },
    ]),
  );
  const deletes: string[][] = [];

  return {
    objects,
    deletes,
    async listObjects(prefix: string) {
      return [...objects.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({ key, size: value.size }))
        .sort((a, b) => a.key.localeCompare(b.key));
    },
    async getJson(key: string) {
      const value = objects.get(key);
      return value ? JSON.parse(value.body) : null;
    },
    async deleteObjects(keys: string[]) {
      deletes.push(keys);
      for (const key of keys) {
        objects.delete(key);
      }
    },
  };
}

describe("S3 GC", () => {
  test("keeps channel-referenced releases and only deletes unreferenced old blobs", async () => {
    const blobA =
      "blobs/sha256/aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.cube";
    const blobB =
      "blobs/sha256/bb/bb/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.cube";
    const blobC =
      "blobs/sha256/cc/cc/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.cube";
    const store = createGcStore({
      "channels/stable/release.json": json({ tag: "v2026.05.01" }),
      "channels/latest/release.json": json({ tag: "v2026.05.02" }),
      "releases/v2026.04.28/release.json": json({
        tag: "v2026.04.28",
        createdAt: "2026-04-28T00:00:00.000Z",
      }),
      "releases/v2026.04.28/blobs-manifest.json": json({
        blobs: [{ key: blobA }],
      }),
      "releases/v2026.04.28/catalog.json": json({}),
      "releases/v2026.05.01/release.json": json({
        tag: "v2026.05.01",
        createdAt: "2026-05-01T00:00:00.000Z",
      }),
      "releases/v2026.05.01/blobs-manifest.json": json({
        blobs: [{ key: blobB }],
      }),
      "releases/v2026.05.01/catalog.json": json({}),
      "releases/v2026.05.02/release.json": json({
        tag: "v2026.05.02",
        createdAt: "2026-05-02T00:00:00.000Z",
      }),
      "releases/v2026.05.02/blobs-manifest.json": json({
        blobs: [{ key: blobC }],
      }),
      "releases/v2026.05.02/catalog.json": json({}),
      [blobA]: "a",
      [blobB]: "b",
      [blobC]: "c",
    });

    const plan = await planS3Gc({
      store,
      keepReleases: 1,
      channelNames: ["stable", "latest"],
    });

    expect(plan.keepTags.sort()).toEqual(["v2026.05.01", "v2026.05.02"]);
    expect(plan.releaseTagsToDelete).toEqual(["v2026.04.28"]);
    expect(plan.deleteKeys).toEqual(
      expect.arrayContaining([
        "releases/v2026.04.28/blobs-manifest.json",
        "releases/v2026.04.28/catalog.json",
        "releases/v2026.04.28/release.json",
        blobA,
      ]),
    );
    expect(plan.deleteKeys).not.toEqual(expect.arrayContaining([blobB, blobC]));

    const dryRun = await runS3Gc({
      store,
      keepReleases: 1,
      channelNames: ["stable", "latest"],
      dryRun: true,
    });

    expect(dryRun.dryRun).toBe(true);
    expect(store.deletes).toEqual([]);
  });
});
