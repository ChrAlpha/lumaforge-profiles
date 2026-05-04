import { refreshProfileAssetMetadata } from "../src/manifest/refresh-assets";
import { validateProfiles } from "../src/manifest/validate";
import { sha256Text } from "../src/utils/hash";
import { createTempRepo, readJson, writeFixture } from "./helpers";

describe("manual profile asset metadata refresh", () => {
  async function writeManualLut(root: string) {
    const assetContent = 'TITLE "Manual Warm"\nLUT_3D_SIZE 2\n';
    await writeFixture(
      root,
      "profiles/lut.manual.warm.v1/assets/warm.cube",
      assetContent,
    );
    await writeFixture(
      root,
      "profiles/lut.manual.warm.v1/manifest.json",
      JSON.stringify(
        {
          schemaVersion: 1,
          id: "org.manual.lut.warm",
          kind: "lut",
          format: "cube",
          version: "1.0.0",
          title: "Manual Warm",
          description: null,
          license: "CC0-1.0",
          author: "Manual maintainer",
          source: "original",
          sourceUrl: null,
          redistributionAllowed: true,
          targets: {},
          assets: [
            {
              role: "cube-lut",
              path: "assets/warm.cube",
              mediaType: "application/x-cube-lut",
              byteSize: 0,
              sha256: "TODO",
            },
          ],
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-01T00:00:00.000Z",
          lut: {
            title: "Manual Warm",
            dimension: "3d",
            size: 2,
            inputTransfer: "v-log",
            inputGamut: "v-gamut",
            outputTransfer: "srgb",
            outputGamut: "rec709",
            intent: "look",
            family: "manual-warm",
            variant: "v1",
          },
        },
        null,
        2,
      ),
    );
    return assetContent;
  }

  test("updates byteSize and sha256 for manually curated LUT manifests", async () => {
    const root = await createTempRepo();
    const assetContent = await writeManualLut(root);

    const result = await refreshProfileAssetMetadata({
      rootDir: root,
      allowedKinds: ["lut"],
      now: "2026-05-04T00:00:00.000Z",
    });

    expect(result.scanned).toBe(1);
    expect(result.manifests).toEqual([
      expect.objectContaining({
        manifestPath: "profiles/lut.manual.warm.v1/manifest.json",
        changed: true,
      }),
    ]);
    expect(result.manifests[0]?.assets).toEqual([
      expect.objectContaining({
        assetPath: "profiles/lut.manual.warm.v1/assets/warm.cube",
        changed: true,
        byteSizeBefore: 0,
        byteSizeAfter: Buffer.byteLength(assetContent),
        sha256Before: "todo",
        sha256After: sha256Text(assetContent),
      }),
    ]);

    const manifest = await readJson<any>(
      root,
      "profiles/lut.manual.warm.v1/manifest.json",
    );
    expect(manifest.assets[0]).toMatchObject({
      byteSize: Buffer.byteLength(assetContent),
      sha256: sha256Text(assetContent),
    });
    expect(manifest.updatedAt).toBe("2026-05-04T00:00:00.000Z");
    expect(manifest.lut).toMatchObject({
      inputTransfer: "v-log",
      inputGamut: "v-gamut",
      outputTransfer: "srgb",
      outputGamut: "rec709",
      family: "manual-warm",
    });

    const validation = await validateProfiles({
      rootDir: root,
      release: true,
      allowedKinds: ["lut"],
    });
    expect(validation.errors).toEqual([]);
  });

  test("dry-run reports manual asset metadata changes without writing manifests", async () => {
    const root = await createTempRepo();
    await writeManualLut(root);

    const result = await refreshProfileAssetMetadata({
      rootDir: root,
      allowedKinds: ["lut"],
      dryRun: true,
      now: "2026-05-04T00:00:00.000Z",
    });

    expect(result.manifests[0]).toMatchObject({
      changed: true,
      dryRun: true,
    });
    const manifest = await readJson<any>(
      root,
      "profiles/lut.manual.warm.v1/manifest.json",
    );
    expect(manifest.assets[0]).toMatchObject({
      byteSize: 0,
      sha256: "TODO",
    });
    expect(manifest.updatedAt).toBe("2026-05-01T00:00:00.000Z");
  });

  test("fails closed when LUT-only refresh sees a non-LUT manifest", async () => {
    const root = await createTempRepo();
    await writeManualLut(root);
    await writeFixture(
      root,
      "profiles/camera.manual.example.v1/assets/example.dcp",
      "fake dcp\n",
    );
    await writeFixture(
      root,
      "profiles/camera.manual.example.v1/manifest.json",
      JSON.stringify(
        {
          schemaVersion: 1,
          id: "org.manual.camera.example",
          kind: "camera-profile",
          format: "dcp",
          version: "1.0.0",
          title: "Manual Camera",
          description: null,
          license: "CC0-1.0",
          author: "Manual maintainer",
          source: "original",
          sourceUrl: null,
          redistributionAllowed: true,
          targets: {},
          assets: [
            {
              role: "dcp",
              path: "assets/example.dcp",
              mediaType: "application/x-adobe-dng-camera-profile",
              byteSize: 1,
              sha256: "0".repeat(64),
            },
          ],
          createdAt: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-05-01T00:00:00.000Z",
        },
        null,
        2,
      ),
    );

    await expect(
      refreshProfileAssetMetadata({
        rootDir: root,
        allowedKinds: ["lut"],
      }),
    ).rejects.toThrow(/kind-filter/i);
  });
});
