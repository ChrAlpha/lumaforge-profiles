import { buildR2Release } from "../src/release/r2-build";
import { R2Publisher } from "../src/release/r2-publisher";
import { createTempRepo, writeProfileEntry } from "./helpers";

function createMemoryStore(existingKeys: string[] = []) {
  const existing = new Set(existingKeys);
  const puts: Array<{
    key: string;
    cacheControl?: string;
    contentType?: string;
  }> = [];
  const heads: string[] = [];

  return {
    existing,
    puts,
    heads,
    async headObject(key: string) {
      heads.push(key);
      return existing.has(key);
    },
    async putObject(input: {
      key: string;
      cacheControl?: string;
      contentType?: string;
    }) {
      puts.push(input);
      existing.add(input.key);
    },
  };
}

describe("R2 publisher", () => {
  test("plans HEAD-based blob skips, assigns cache headers, and updates channels last", async () => {
    const root = await createTempRepo();
    await writeProfileEntry(root, {
      id: "org.lumaforge.lut.a",
      entryDir: "profiles/lut.lumaforge.a.v1",
      assetFileName: "a.cube",
      assetContent: 'TITLE "A"\n',
    });
    await writeProfileEntry(root, {
      id: "org.lumaforge.camera.a",
      entryDir: "profiles/camera.a.v1",
      kind: "camera-profile",
      format: "dcp",
      assetFileName: "a.dcp",
      assetContent: "camera bytes\n",
    });
    const build = await buildR2Release({
      rootDir: root,
      tag: "v2026.04.29",
      publicBaseUrl: "https://profiles.lumaforge.invalid",
      now: "2026-04-29T00:00:00.000Z",
    });
    const store = createMemoryStore([build.blobs[0]!.key]);
    const publisher = new R2Publisher({
      bucket: "lumaforge-profiles",
      publicBaseUrl: "https://profiles.lumaforge.invalid",
      store,
    });

    const plan = await publisher.plan({
      build,
      channelNames: ["stable"],
    });

    expect(
      plan.objects
        .filter((object) => object.phase === "blob")
        .map((object) => object.action)
        .sort(),
    ).toEqual(["skip", "upload"]);
    expect(
      plan.objects.find((object) => object.key === build.blobs[0]!.key),
    ).toMatchObject({
      phase: "blob",
      action: "skip",
      cacheControl: "public, max-age=31536000, immutable",
    });
    expect(
      plan.objects.find(
        (object) => object.key === "channels/stable/catalog.json",
      ),
    ).toMatchObject({
      phase: "channel",
      action: "update",
      cacheControl: "public, max-age=60, stale-while-revalidate=600",
    });
    expect(plan.estimatedClassBOperations).toBe(build.blobs.length);
    expect(plan.objects.slice(-2).map((object) => object.key)).toEqual([
      "channels/stable/catalog.json",
      "channels/stable/release.json",
    ]);
  });

  test("dry-run does not upload objects and publish uploads blobs before channels", async () => {
    const root = await createTempRepo();
    await writeProfileEntry(root, {
      id: "org.lumaforge.lut.a",
      entryDir: "profiles/lut.lumaforge.a.v1",
      assetFileName: "shared.cube",
      assetContent: 'TITLE "Shared"\n',
    });
    await writeProfileEntry(root, {
      id: "org.lumaforge.lut.b",
      entryDir: "profiles/lut.lumaforge.b.v1",
      assetFileName: "shared-again.cube",
      assetContent: 'TITLE "Shared"\n',
    });
    const build = await buildR2Release({
      rootDir: root,
      tag: "v2026.04.29",
      publicBaseUrl: "https://profiles.lumaforge.invalid",
      now: "2026-04-29T00:00:00.000Z",
    });
    const store = createMemoryStore();
    const publisher = new R2Publisher({
      bucket: "lumaforge-profiles",
      publicBaseUrl: "https://profiles.lumaforge.invalid",
      store,
    });

    const dryRun = await publisher.publish({
      build,
      channelNames: ["stable"],
      dryRun: true,
    });
    expect(dryRun.dryRun).toBe(true);
    expect(store.puts).toEqual([]);

    const published = await publisher.publish({
      build,
      channelNames: ["stable"],
      dryRun: false,
    });

    expect(published.uploadedBlobCount).toBe(1);
    expect(store.puts[0]?.key).toMatch(/^blobs\/sha256\//);
    expect(store.puts.slice(-2).map((item) => item.key)).toEqual([
      "channels/stable/catalog.json",
      "channels/stable/release.json",
    ]);
  });
});
