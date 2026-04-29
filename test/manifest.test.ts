import path from "node:path";

import { generateRepositoryIndex } from "../src/manifest";
import { validateProfiles } from "../src/manifest/validate";
import { createTempRepo, readJson, writeFixture } from "./helpers";

const safeManifest = {
  schemaVersion: 1,
  id: "org.lumaforge.lut.safe",
  kind: "lut",
  format: "cube",
  version: "1.0.0",
  title: "Safe LUT",
  description: null,
  license: "CC0-1.0",
  author: "LumaForge contributors",
  source: "original",
  sourceUrl: null,
  redistributionAllowed: true,
  targets: {},
  assets: [
    {
      role: "cube-lut",
      path: "assets/safe.cube",
      mediaType: "application/x-cube-lut",
      byteSize: 13,
      sha256: "1843c8e7068c6cb1b47e4e4bc807082c8f9fb8ca44a18a7ac7136d4467af923a"
    }
  ],
  createdAt: "2026-04-28T00:00:00.000Z",
  updatedAt: "2026-04-28T00:00:00.000Z"
};

async function writeManifest(root: string, entryDir: string, manifest: any, assetContent = "TITLE \"safe\"\n") {
  await writeFixture(root, `${entryDir}/assets/${manifest.assets?.[0]?.path?.split("/").pop() ?? "safe.cube"}`, assetContent);
  const actualPath = `${entryDir}/manifest.json`;
  await writeFixture(root, actualPath, JSON.stringify(manifest, null, 2));
  return actualPath;
}

describe("manifest validation and index", () => {
  test("detects schema errors, missing assets, hash mismatch, duplicate ids, and release-unsafe licenses", async () => {
    const root = await createTempRepo();
    await writeManifest(root, "profiles/lut.lumaforge.safe.v1", safeManifest);
    await writeFixture(
      root,
      "profiles/lut.lumaforge.invalid.v1/manifest.json",
      JSON.stringify({ ...safeManifest, id: "org.lumaforge.invalid", kind: "unknown-kind" }, null, 2)
    );
    await writeManifest(root, "profiles/lut.lumaforge.duplicate-a.v1", { ...safeManifest, title: "Duplicate A" });
    await writeManifest(root, "profiles/lut.lumaforge.duplicate-b.v1", { ...safeManifest, title: "Duplicate B" });
    await writeFixture(
      root,
      "profiles/lut.lumaforge.missing.v1/manifest.json",
      JSON.stringify(
        {
          ...safeManifest,
          id: "org.lumaforge.lut.missing",
          assets: [{ ...safeManifest.assets[0], path: "assets/missing.cube" }]
        },
        null,
        2
      )
    );
    await writeManifest(
      root,
      "profiles/lut.lumaforge.hash.v1",
      {
        ...safeManifest,
        id: "org.lumaforge.lut.hash",
        assets: [{ ...safeManifest.assets[0], path: "assets/hash.cube", sha256: "0".repeat(64) }]
      },
      "TITLE \"changed\"\n"
    );
    await writeManifest(root, "profiles/lut.lumaforge.unsafe.v1", {
      ...safeManifest,
      id: "org.lumaforge.lut.unsafe",
      license: "NOASSERTION",
      redistributionAllowed: false
    });

    const normal = await validateProfiles({ rootDir: root });
    expect(normal.errors.map((item) => item.code)).toEqual(
      expect.arrayContaining(["schema", "duplicate-id", "asset-missing", "asset-sha256"])
    );
    expect(normal.warnings.map((item) => item.code)).toEqual(
      expect.arrayContaining(["release-redistribution", "release-license"])
    );

    const release = await validateProfiles({ rootDir: root, release: true });
    expect(release.errors.map((item) => item.code)).toEqual(
      expect.arrayContaining(["release-redistribution", "release-license"])
    );
  });

  test("generates a stable sorted repository index while preserving repository metadata", async () => {
    const root = await createTempRepo();
    await writeFixture(
      root,
      "lumaforge-profiles.json",
      JSON.stringify(
        {
          schemaVersion: 1,
          id: "custom.registry",
          title: "Custom Title",
          description: "Custom description",
          entriesRoot: "profiles",
          defaultEntryGlob: "profiles/*/manifest.json",
          generatedAt: "2026-01-01T00:00:00.000Z",
          entries: []
        },
        null,
        2
      )
    );
    await writeManifest(root, "profiles/lut.lumaforge.z.v1", {
      ...safeManifest,
      id: "org.lumaforge.lut.z",
      title: "Z LUT"
    });
    await writeManifest(root, "profiles/lut.lumaforge.a.v1", {
      ...safeManifest,
      id: "org.lumaforge.lut.a",
      title: "A LUT"
    });

    const index = await generateRepositoryIndex({ rootDir: root, now: "2026-04-28T00:00:00.000Z" });

    expect(index.id).toBe("custom.registry");
    expect(index.title).toBe("Custom Title");
    expect(index.entries.map((entry) => entry.id)).toEqual(["org.lumaforge.lut.a", "org.lumaforge.lut.z"]);

    const written = await readJson<any>(root, "lumaforge-profiles.json");
    expect(written.generatedAt).toBe("2026-04-28T00:00:00.000Z");
    expect(written.entries.map((entry: any) => entry.manifest)).toEqual([
      "profiles/lut.lumaforge.a.v1/manifest.json",
      "profiles/lut.lumaforge.z.v1/manifest.json"
    ]);
  });

  test("includes LUT contract metadata in the repository index for runtime filtering", async () => {
    const root = await createTempRepo();
    await writeManifest(root, "profiles/lut.arri.1110-black-and-white-logc3-rec709.v1", {
      ...safeManifest,
      id: "org.arri.lut.1110-black-and-white-logc3-rec709",
      title: "1110 Black and White LogC3 Rec.709",
      lut: {
        title: "1110 Black and White",
        dimension: "3d",
        size: 33,
        inputTransfer: "arri-logc3",
        inputGamut: "arri-wide-gamut-3",
        outputTransfer: "srgb",
        outputGamut: "rec709",
        intent: "look",
        family: "arri-look-library",
        variant: "1110-black-and-white"
      }
    });

    const index = await generateRepositoryIndex({ rootDir: root, now: "2026-04-28T00:00:00.000Z" });

    expect(index.entries).toEqual([
      expect.objectContaining({
        id: "org.arri.lut.1110-black-and-white-logc3-rec709",
        kind: "lut",
        format: "cube",
        title: "1110 Black and White LogC3 Rec.709",
        manifest: "profiles/lut.arri.1110-black-and-white-logc3-rec709.v1/manifest.json",
        lut: expect.objectContaining({
          inputTransfer: "arri-logc3",
          inputGamut: "arri-wide-gamut-3",
          outputTransfer: "srgb",
          outputGamut: "rec709"
        })
      })
    ]);
  });

  test("rejects asset paths that escape the entry directory", async () => {
    const root = await createTempRepo();
    await writeFixture(root, "outside.cube", "TITLE \"outside\"\n");
    await writeFixture(
      root,
      "profiles/lut.lumaforge.escape.v1/manifest.json",
      JSON.stringify(
        {
          ...safeManifest,
          id: "org.lumaforge.lut.escape",
          assets: [{ ...safeManifest.assets[0], path: "../outside.cube" }]
        },
        null,
        2
      )
    );

    const result = await validateProfiles({ rootDir: root });
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "asset-path",
        manifestPath: path.posix.join("profiles", "lut.lumaforge.escape.v1", "manifest.json")
      })
    );
  });
});
