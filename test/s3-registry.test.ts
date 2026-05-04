import {
  loadPublishedS3Channel,
  loadPublishedS3Entry,
  loadPublishedS3Release,
} from "../src/release/s3-registry";

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function createRegistryStore(seed: Record<string, string>) {
  const objects = new Map(Object.entries(seed));

  return {
    async getJson<T>(key: string) {
      const raw = objects.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    },
  };
}

describe("published S3 registry reader", () => {
  test("loads the current channel state from bucket-managed catalog and release pointers", async () => {
    const store = createRegistryStore({
      "channels/stable/release.json": json({
        schemaVersion: 1,
        tag: "v2026.05.01",
        createdAt: "2026-05-01T00:00:00.000Z",
        entryCount: 1,
        blobCount: 1,
        totalBlobBytes: 16,
        catalogUrl:
          "https://profiles.lumaforge.invalid/releases/v2026.05.01/catalog.json",
        channelNames: ["stable"],
        sourceGitCommit: "abc123",
      }),
      "channels/stable/catalog.json": json({
        schemaVersion: 1,
        id: "org.lumaforge.profiles",
        title: "LumaForge Profiles",
        description: "Profiles",
        tag: "v2026.05.01",
        generatedAt: "2026-05-01T00:00:00.000Z",
        publicBaseUrl: "https://profiles.lumaforge.invalid",
        entries: [
          {
            id: "org.lumaforge.lut.a",
            kind: "lut",
            version: "1.0.0",
            title: "A",
            license: "CC0-1.0",
            redistributionAllowed: true,
            primaryAsset: {
              role: "cube-lut",
              mediaType: "application/x-cube-lut",
              size: 16,
              sha256:
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              url: "https://profiles.lumaforge.invalid/blobs/sha256/aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.cube",
            },
            entryUrl:
              "https://profiles.lumaforge.invalid/releases/v2026.05.01/entries/org.lumaforge.lut.a.json",
          },
        ],
      }),
    });

    const channel = await loadPublishedS3Channel(store, { channel: "stable" });

    expect(channel).toMatchObject({
      channel: "stable",
      tag: "v2026.05.01",
      release: {
        tag: "v2026.05.01",
      },
      catalog: {
        tag: "v2026.05.01",
      },
    });
    expect(channel?.catalog.entries[0]?.id).toBe("org.lumaforge.lut.a");
  });

  test("loads a tagged release and its entry documents from the published bucket state", async () => {
    const store = createRegistryStore({
      "releases/v2026.05.01/release.json": json({
        schemaVersion: 1,
        tag: "v2026.05.01",
        createdAt: "2026-05-01T00:00:00.000Z",
        entryCount: 1,
        blobCount: 1,
        totalBlobBytes: 16,
        catalogUrl:
          "https://profiles.lumaforge.invalid/releases/v2026.05.01/catalog.json",
        channelNames: ["stable"],
        sourceGitCommit: "abc123",
      }),
      "releases/v2026.05.01/catalog.json": json({
        schemaVersion: 1,
        id: "org.lumaforge.profiles",
        title: "LumaForge Profiles",
        description: "Profiles",
        tag: "v2026.05.01",
        generatedAt: "2026-05-01T00:00:00.000Z",
        publicBaseUrl: "https://profiles.lumaforge.invalid",
        entries: [
          {
            id: "org.lumaforge.lut.a",
            kind: "lut",
            version: "1.0.0",
            title: "A",
            license: "CC0-1.0",
            redistributionAllowed: true,
            primaryAsset: {
              role: "cube-lut",
              mediaType: "application/x-cube-lut",
              size: 16,
              sha256:
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              url: "https://profiles.lumaforge.invalid/blobs/sha256/aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.cube",
            },
            entryUrl:
              "https://profiles.lumaforge.invalid/releases/v2026.05.01/entries/org.lumaforge.lut.a.json",
          },
        ],
      }),
      "releases/v2026.05.01/blobs-manifest.json": json({
        schemaVersion: 1,
        tag: "v2026.05.01",
        generatedAt: "2026-05-01T00:00:00.000Z",
        totalBlobBytes: 16,
        blobs: [
          {
            key: "blobs/sha256/aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.cube",
            url: "https://profiles.lumaforge.invalid/blobs/sha256/aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.cube",
            mediaType: "application/x-cube-lut",
            size: 16,
            sha256:
              "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            references: [
              {
                entryId: "org.lumaforge.lut.a",
                role: "cube-lut",
                originalPath: "assets/a.cube",
              },
            ],
          },
        ],
      }),
      "releases/v2026.05.01/entries/org.lumaforge.lut.a.json": json({
        schemaVersion: 1,
        id: "org.lumaforge.lut.a",
        kind: "lut",
        format: "cube",
        version: "1.0.0",
        title: "A",
        description: null,
        license: "CC0-1.0",
        author: "LumaForge contributors",
        source: "original",
        sourceUrl: null,
        redistributionAllowed: true,
        targets: {},
        manifestPath: "profiles/lut.lumaforge.a.v1/manifest.json",
        entryUrl:
          "https://profiles.lumaforge.invalid/releases/v2026.05.01/entries/org.lumaforge.lut.a.json",
        primaryAsset: {
          role: "cube-lut",
          mediaType: "application/x-cube-lut",
          size: 16,
          sha256:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          url: "https://profiles.lumaforge.invalid/blobs/sha256/aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.cube",
        },
        assets: [
          {
            role: "cube-lut",
            mediaType: "application/x-cube-lut",
            originalPath: "assets/a.cube",
            size: 16,
            sha256:
              "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            key: "blobs/sha256/aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.cube",
            url: "https://profiles.lumaforge.invalid/blobs/sha256/aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.cube",
          },
        ],
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
      }),
    });

    const release = await loadPublishedS3Release(store, {
      tag: "v2026.05.01",
      includeEntries: true,
    });
    const entry = await loadPublishedS3Entry(store, {
      tag: "v2026.05.01",
      entryId: "org.lumaforge.lut.a",
    });

    expect(release).toMatchObject({
      tag: "v2026.05.01",
      release: {
        tag: "v2026.05.01",
      },
      blobsManifest: {
        tag: "v2026.05.01",
      },
    });
    expect(release?.entries[0]?.id).toBe("org.lumaforge.lut.a");
    expect(entry?.id).toBe("org.lumaforge.lut.a");
    expect(entry?.primaryAsset.role).toBe("cube-lut");
  });
});
