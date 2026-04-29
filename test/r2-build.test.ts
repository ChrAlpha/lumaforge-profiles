import fs from "node:fs/promises";
import path from "node:path";

import { buildR2Release, loadBuiltR2Release } from "../src/release/r2-build";
import { sha256Text } from "../src/utils/hash";
import {
  readJson,
  writeFixture,
  writeProfileEntry,
  createTempRepo,
} from "./helpers";

describe("R2 release build", () => {
  test("builds catalog, entry documents, blob manifests, and audit files for CDN delivery", async () => {
    const root = await createTempRepo();
    const publicBaseUrl = "https://profiles.lumaforge.invalid/";
    const noticeText = "Third-party notice\n";
    const lut = await writeProfileEntry(root, {
      id: "org.lumaforge.lut.neutral-rec709",
      entryDir: "profiles/lut.lumaforge.neutral-rec709.v1",
      title: "Neutral Rec.709",
      assetFileName: "neutral-rec709.cube",
      assetContent: 'TITLE "Neutral Rec.709"\n',
    });
    await writeFixture(
      root,
      "profiles/lut.lumaforge.neutral-rec709.v1/NOTICE.md",
      noticeText,
    );
    const manifest = await readJson<any>(
      root,
      "profiles/lut.lumaforge.neutral-rec709.v1/manifest.json",
    );
    manifest.assets.push({
      role: "notice",
      path: "NOTICE.md",
      mediaType: "text/markdown",
      byteSize: noticeText.length,
      sha256: sha256Text(noticeText),
    });
    await writeFixture(
      root,
      "profiles/lut.lumaforge.neutral-rec709.v1/manifest.json",
      JSON.stringify(manifest, null, 2),
    );

    await writeProfileEntry(root, {
      id: "org.lumaforge.camera.sony.ilce-7m4",
      entryDir: "profiles/camera.sony.ilce-7m4.v1",
      kind: "camera-profile",
      format: "dcp",
      title: "Sony ILCE-7M4 Standard",
      assetFileName: "standard.dcp",
      assetContent: "fake dcp profile\n",
    });

    const result = await buildR2Release({
      rootDir: root,
      tag: "v2026.04.29",
      publicBaseUrl,
      now: "2026-04-29T00:00:00.000Z",
    });

    expect(result.outputDir).toBe(
      path.join(root, "dist", "r2-release", "v2026.04.29"),
    );
    expect(result.blobs).toHaveLength(3);
    expect(result.entries).toHaveLength(2);

    const catalog = await readJson<any>(
      root,
      "dist/r2-release/v2026.04.29/catalog.json",
    );
    expect(catalog.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "org.lumaforge.lut.neutral-rec709",
          kind: "lut",
          redistributionAllowed: true,
          primaryAsset: expect.objectContaining({
            role: "cube-lut",
            mediaType: "application/x-cube-lut",
            size: lut.byteSize,
            sha256: lut.sha256,
            url: expect.stringMatching(
              /^https:\/\/profiles\.lumaforge\.invalid\/blobs\/sha256\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{64}\.cube$/,
            ),
          }),
        }),
        expect.objectContaining({
          id: "org.lumaforge.camera.sony.ilce-7m4",
          kind: "camera-profile",
          primaryAsset: expect.objectContaining({
            role: "dcp",
            mediaType: "application/x-adobe-dng-camera-profile",
          }),
        }),
      ]),
    );

    const entryDocument = await readJson<any>(
      root,
      "dist/r2-release/v2026.04.29/entries/org.lumaforge.lut.neutral-rec709.json",
    );
    expect(entryDocument.primaryAsset.role).toBe("cube-lut");
    expect(entryDocument.assets.map((asset: any) => asset.role).sort()).toEqual(
      ["cube-lut", "notice"],
    );
    expect(
      entryDocument.assets.find((asset: any) => asset.role === "notice"),
    ).toMatchObject({
      url: expect.stringMatching(
        /^https:\/\/profiles\.lumaforge\.invalid\/blobs\/sha256\/[a-f0-9]{2}\//,
      ),
      mediaType: "text/markdown",
    });

    const release = await readJson<any>(
      root,
      "dist/r2-release/v2026.04.29/release.json",
    );
    expect(release).toMatchObject({
      tag: "v2026.04.29",
      createdAt: "2026-04-29T00:00:00.000Z",
      entryCount: 2,
      blobCount: 3,
      catalogUrl:
        "https://profiles.lumaforge.invalid/releases/v2026.04.29/catalog.json",
    });

    const blobsManifest = await readJson<any>(
      root,
      "dist/r2-release/v2026.04.29/blobs-manifest.json",
    );
    expect(blobsManifest.blobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: expect.stringMatching(
            /^blobs\/sha256\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{64}\.cube$/,
          ),
          url: expect.stringMatching(
            /^https:\/\/profiles\.lumaforge\.invalid\/blobs\/sha256\//,
          ),
        }),
      ]),
    );

    const publishPlan = await readJson<any>(
      root,
      "dist/r2-release/v2026.04.29/publish-plan.json",
    );
    expect(publishPlan.objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: "blob",
          key: expect.stringMatching(/^blobs\/sha256\//),
          cacheControl: "public, max-age=31536000, immutable",
        }),
        expect.objectContaining({
          phase: "release-catalog",
          key: "releases/v2026.04.29/catalog.json",
          cacheControl: "public, max-age=86400, immutable",
        }),
      ]),
    );

    const checksums = await fs.readFile(
      path.join(result.outputDir, "checksums.txt"),
      "utf8",
    );
    expect(checksums).toContain("catalog.json");
    expect(checksums).toContain(
      "entries/org.lumaforge.lut.neutral-rec709.json",
    );
    expect(checksums).toContain("release.json");
  });

  test("reuses the same content-addressed blob across releases and duplicate entry bytes", async () => {
    const root = await createTempRepo();
    await writeProfileEntry(root, {
      id: "org.lumaforge.lut.a",
      entryDir: "profiles/lut.lumaforge.a.v1",
      title: "A",
      assetFileName: "same-a.cube",
      assetContent: 'TITLE "Same"\n',
    });
    await writeProfileEntry(root, {
      id: "org.lumaforge.lut.b",
      entryDir: "profiles/lut.lumaforge.b.v1",
      title: "B",
      assetFileName: "same-b.cube",
      assetContent: 'TITLE "Same"\n',
    });

    const first = await buildR2Release({
      rootDir: root,
      tag: "v2026.04.29",
      publicBaseUrl: "https://profiles.lumaforge.invalid",
      now: "2026-04-29T00:00:00.000Z",
    });
    const second = await buildR2Release({
      rootDir: root,
      tag: "v2026.05.01",
      publicBaseUrl: "https://profiles.lumaforge.invalid",
      now: "2026-05-01T00:00:00.000Z",
    });

    expect(first.blobs).toHaveLength(1);
    expect(second.blobs).toHaveLength(1);
    expect(first.blobs[0]?.key).toBe(second.blobs[0]?.key);

    const firstCatalog = await readJson<any>(
      root,
      "dist/r2-release/v2026.04.29/catalog.json",
    );
    expect(
      new Set(firstCatalog.entries.map((entry: any) => entry.primaryAsset.url))
        .size,
    ).toBe(1);
  });

  test("reloads a built R2 release from dist artifacts without rebuilding", async () => {
    const root = await createTempRepo();
    await writeProfileEntry(root, {
      id: "org.lumaforge.lut.reload",
      entryDir: "profiles/lut.lumaforge.reload.v1",
      title: "Reload",
      assetFileName: "reload.cube",
      assetContent: 'TITLE "Reload"\n',
    });

    const built = await buildR2Release({
      rootDir: root,
      tag: "v2026.04.29",
      publicBaseUrl: "https://profiles.lumaforge.invalid",
      now: "2026-04-29T00:00:00.000Z",
    });
    const loaded = await loadBuiltR2Release({
      rootDir: root,
      tag: "v2026.04.29",
    });

    expect(loaded.catalog).toEqual(built.catalog);
    expect(loaded.release).toEqual(built.release);
    expect(loaded.blobs.map((blob) => blob.key)).toEqual(
      built.blobs.map((blob) => blob.key),
    );
    expect(loaded.objects.map((object) => object.key)).toEqual(
      built.objects.map((object) => object.key),
    );
  });

  test("fails closed when a manifest is not releasable", async () => {
    const root = await createTempRepo();
    await writeProfileEntry(root, {
      id: "org.lumaforge.lut.local-only",
      entryDir: "profiles/lut.lumaforge.local-only.v1",
      redistributionAllowed: false,
    });

    await expect(
      buildR2Release({
        rootDir: root,
        tag: "v2026.04.29",
        publicBaseUrl: "https://profiles.lumaforge.invalid",
      }),
    ).rejects.toThrow(/release-redistribution/i);
  });
});
