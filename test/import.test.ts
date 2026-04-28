import fs from "node:fs/promises";
import path from "node:path";

import { classifyProfileFile } from "../src/import/classify";
import { importProfiles } from "../src/import/write-entry";
import { scanImportDirectory } from "../src/import/scan";
import { sha256File } from "../src/utils/hash";
import { slugify } from "../src/utils/slug";
import { createTempRepo, readJson, writeFixture } from "./helpers";

describe("profile import", () => {
  test("recursively scans complex import trees and classifies supported assets", async () => {
    const root = await createTempRepo();
    await writeFixture(root, ".local-profile-imports/LUTs/film/neutral-rec709.cube", "TITLE \"Neutral Rec709\"\nLUT_3D_SIZE 2\n");
    await writeFixture(root, ".local-profile-imports/Adobe/DCP/Sony/ILCE-7M4/Camera Standard.dcp", "fake dcp fixture\n");
    await writeFixture(root, ".local-profile-imports/LCP/Sony/FE 24-70mm F2.8 GM II.lcp", "<lensprofile><model>FE 24-70mm F2.8 GM II</model></lensprofile>\n");
    await writeFixture(root, ".local-profile-imports/ignored/readme.txt", "ignore me\n");

    const scanned = await scanImportDirectory(path.join(root, ".local-profile-imports"));

    expect(scanned.map((item) => item.relativePath).sort()).toEqual([
      "Adobe/DCP/Sony/ILCE-7M4/Camera Standard.dcp",
      "LCP/Sony/FE 24-70mm F2.8 GM II.lcp",
      "LUTs/film/neutral-rec709.cube"
    ]);
    expect(scanned.map((item) => item.classification.kind).sort()).toEqual([
      "camera-profile",
      "lens-correction-profile",
      "lut"
    ]);
  });

  test("classifies cube, dcp, and lcp files with release roles and media types", () => {
    expect(classifyProfileFile("example.cube")).toMatchObject({
      kind: "lut",
      format: "cube",
      role: "cube-lut",
      mediaType: "application/x-cube-lut"
    });
    expect(classifyProfileFile("Camera Standard.dcp")).toMatchObject({
      kind: "camera-profile",
      format: "dcp",
      role: "dng-camera-profile",
      mediaType: "application/x-dng-camera-profile"
    });
    expect(classifyProfileFile("Lens.lcp")).toMatchObject({
      kind: "lens-correction-profile",
      format: "lcp",
      role: "lens-correction-profile",
      mediaType: "application/x-lens-correction-profile"
    });
    expect(classifyProfileFile("notes.txt")).toBeNull();
  });

  test("creates stable safe slugs and avoids same-name import collisions", async () => {
    expect(slugify("  Camera Standard @ Sony/ILCE 7M4!! ")).toBe("camera-standard-sony-ilce-7m4");

    const root = await createTempRepo();
    await writeFixture(root, "imports/a/Neutral Rec709.cube", "TITLE \"A\"\nLUT_3D_SIZE 2\n");
    await writeFixture(root, "imports/b/Neutral Rec709.cube", "TITLE \"B\"\nLUT_3D_SIZE 2\n");

    const result = await importProfiles({
      rootDir: root,
      fromDir: path.join(root, "imports"),
      namespace: "lumaforge",
      author: "LumaForge contributors",
      license: "CC0-1.0",
      redistributionAllowed: true,
      now: "2026-04-28T00:00:00.000Z"
    });

    expect(result.written).toHaveLength(2);
    const entryDirs = result.written.map((item) => item.entryDir);
    expect(entryDirs).toContain("profiles/lut.lumaforge.neutral-rec709.v1");
    expect(entryDirs).toContainEqual(expect.stringMatching(/^profiles\/lut\.lumaforge\.neutral-rec709-[a-f0-9]{8}\.v1$/));
  });

  test("writes flattened manifests with copied assets, sha256, byteSize, and parsed cube metadata", async () => {
    const root = await createTempRepo();
    const sourcePath = await writeFixture(
      root,
      ".local-profile-imports/LUTs/neutral-rec709.cube",
      "TITLE \"Neutral Rec709\"\nLUT_3D_SIZE 2\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n0 0 0\n1 1 1\n"
    );

    const result = await importProfiles({
      rootDir: root,
      fromDir: path.join(root, ".local-profile-imports"),
      namespace: "lumaforge",
      author: "LumaForge contributors",
      license: "CC0-1.0",
      redistributionAllowed: true,
      now: "2026-04-28T00:00:00.000Z"
    });

    const entry = result.written[0]!;
    const manifest = await readJson<any>(root, `${entry.entryDir}/manifest.json`);
    const copiedAsset = path.join(root, entry.entryDir, "assets", "neutral-rec709.cube");

    expect(manifest).toMatchObject({
      id: "org.lumaforge.lut.neutral-rec709",
      kind: "lut",
      format: "cube",
      version: "1.0.0",
      title: "Neutral Rec709",
      license: "CC0-1.0",
      author: "LumaForge contributors",
      redistributionAllowed: true,
      lut: {
        title: "Neutral Rec709",
        dimension: "3d",
        size: 2,
        domainMin: [0, 0, 0],
        domainMax: [1, 1, 1]
      }
    });
    expect(manifest.assets[0]).toMatchObject({
      role: "cube-lut",
      path: "assets/neutral-rec709.cube",
      mediaType: "application/x-cube-lut",
      byteSize: (await fs.stat(sourcePath)).size,
      sha256: await sha256File(sourcePath)
    });
    expect(await fs.readFile(copiedAsset, "utf8")).toContain("Neutral Rec709");
  });

  test("updates asset metadata for an existing manifest while preserving curated fields", async () => {
    const root = await createTempRepo();
    const entryDir = "profiles/lut.lumaforge.neutral-rec709.v1";
    await writeFixture(root, `${entryDir}/assets/neutral-rec709.cube`, "TITLE \"old\"\nLUT_3D_SIZE 2\n");
    await writeFixture(
      root,
      `${entryDir}/manifest.json`,
      JSON.stringify(
        {
          schemaVersion: 1,
          id: "org.lumaforge.lut.neutral-rec709",
          kind: "lut",
          format: "cube",
          version: "1.0.0",
          title: "Curated Neutral",
          description: "Edited by a maintainer",
          license: "Custom-License",
          author: "Curated Author",
          source: "third-party",
          sourceUrl: "https://example.test/source",
          redistributionAllowed: true,
          targets: { custom: ["keep"] },
          assets: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        },
        null,
        2
      )
    );
    await writeFixture(root, "imports/neutral-rec709.cube", "TITLE \"new\"\nLUT_3D_SIZE 2\n0 0 0\n1 1 1\n");

    await importProfiles({
      rootDir: root,
      fromDir: path.join(root, "imports"),
      namespace: "lumaforge",
      author: "LumaForge contributors",
      license: "CC0-1.0",
      redistributionAllowed: true,
      overwriteAssets: true,
      now: "2026-04-28T00:00:00.000Z"
    });

    const manifest = await readJson<any>(root, `${entryDir}/manifest.json`);
    expect(manifest).toMatchObject({
      title: "Curated Neutral",
      description: "Edited by a maintainer",
      license: "Custom-License",
      author: "Curated Author",
      source: "third-party",
      sourceUrl: "https://example.test/source",
      targets: { custom: ["keep"] },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-04-28T00:00:00.000Z"
    });
    expect(manifest.assets[0].sha256).toBe(await sha256File(path.join(root, "imports/neutral-rec709.cube")));
  });
});
