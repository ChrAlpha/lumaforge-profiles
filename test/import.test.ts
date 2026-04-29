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
      role: "dcp",
      mediaType: "application/x-adobe-dng-camera-profile"
    });
    expect(classifyProfileFile("Lens.lcp")).toMatchObject({
      kind: "lens-correction-profile",
      format: "lcp",
      role: "lcp",
      mediaType: "application/x-adobe-lens-correction-profile"
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

  test("applies source package rules and keeps same-look ARRI curve variants distinct", async () => {
    const root = await createTempRepo();
    await writeFixture(
      root,
      "imports/arri/look-library-logc3-to-rec709/ARRI Look Library LogC3 to Rec709 3D-LUTs/1110-Black-and-White.cube",
      "TITLE \"1110 Black and White\"\nLUT_3D_SIZE 33\n"
    );
    await writeFixture(
      root,
      "imports/arri/look-library-logc4-log-to-log/ARRI Look Library for LogC4 (3D-LUTs)/1110 Black and White.cube",
      "TITLE \"1110 Black and White\"\nLUT_3D_SIZE 33\n"
    );
    await writeFixture(
      root,
      "imports/fujifilm/f-log2-to-eterna/FLog2_to_ETERNA_33grid.cube",
      "TITLE \"FLog2 to ETERNA 33grid\"\nLUT_3D_SIZE 33\n"
    );
    await writeFixture(
      root,
      "imports/fujifilm/f-log-to-eterna/FLog_to_ETERNA_33grid.cube",
      "TITLE \"FLog to ETERNA 33grid\"\nLUT_3D_SIZE 33\n"
    );
    await writeFixture(
      root,
      "imports/fujifilm/f-log2c-to-eterna/FLog2C_to_ETERNA_33grid.cube",
      "TITLE \"FLog2C to ETERNA 33grid\"\nLUT_3D_SIZE 33\n"
    );

    const arri = await importProfiles({
      rootDir: root,
      fromDir: path.join(root, "imports/arri"),
      namespace: "arri",
      author: "ARRI",
      license: "NOASSERTION",
      redistributionAllowed: false,
      now: "2026-04-28T00:00:00.000Z"
    });
    await importProfiles({
      rootDir: root,
      fromDir: path.join(root, "imports/fujifilm"),
      namespace: "fujifilm",
      author: "FUJIFILM",
      license: "NOASSERTION",
      redistributionAllowed: false,
      now: "2026-04-28T00:00:00.000Z"
    });

    expect(arri.written.map((entry) => entry.entryDir).sort()).toEqual([
      "profiles/lut.arri.1110-black-and-white-logc3-rec709.v1",
      "profiles/lut.arri.1110-black-and-white-logc4-log.v1"
    ]);

    const logc3 = await readJson<any>(root, "profiles/lut.arri.1110-black-and-white-logc3-rec709.v1/manifest.json");
    const logc4 = await readJson<any>(root, "profiles/lut.arri.1110-black-and-white-logc4-log.v1/manifest.json");
    const flog = await readJson<any>(root, "profiles/lut.fujifilm.flog-to-eterna-33grid.v1/manifest.json");
    const flog2 = await readJson<any>(root, "profiles/lut.fujifilm.flog2-to-eterna-33grid.v1/manifest.json");
    const flog2c = await readJson<any>(root, "profiles/lut.fujifilm.flog2c-to-eterna-33grid.v1/manifest.json");

    expect(logc3.lut).toMatchObject({
      inputTransfer: "arri-logc3",
      inputGamut: "arri-wide-gamut-3",
      outputTransfer: "srgb",
      outputGamut: "rec709",
      intent: "look",
      family: "arri-look-library",
      variant: "1110-black-and-white",
      contractSource: "source-package-rule",
      contractSourceId: "arri-look-library-logc3-to-rec709",
      contractConfidence: "high"
    });
    expect(logc4.lut).toMatchObject({
      inputTransfer: "arri-logc4",
      inputGamut: "arri-wide-gamut-4",
      outputTransfer: "arri-logc4",
      outputGamut: "arri-wide-gamut-4",
      intent: "look",
      family: "arri-look-library",
      variant: "1110-black-and-white",
      contractSource: "source-package-rule",
      contractSourceId: "arri-look-library-logc4-log-to-log",
      contractConfidence: "high"
    });
    expect(flog2.lut).toMatchObject({
      inputTransfer: "fujifilm-f-log2",
      inputGamut: "fujifilm-f-gamut",
      outputTransfer: "srgb",
      outputGamut: "rec709",
      intent: "look",
      family: "fujifilm-film-simulation",
      variant: "eterna",
      contractSource: "source-package-rule",
      contractSourceId: "fujifilm-f-log2-to-eterna",
      contractConfidence: "high"
    });
    expect(flog.lut).toMatchObject({
      inputTransfer: "fujifilm-f-log",
      inputGamut: "fujifilm-f-gamut",
      outputTransfer: "srgb",
      outputGamut: "rec709",
      intent: "look",
      family: "fujifilm-film-simulation",
      variant: "eterna",
      contractSource: "source-package-rule",
      contractSourceId: "fujifilm-f-log-to-eterna",
      contractConfidence: "high"
    });
    expect(flog2c.lut).toMatchObject({
      inputTransfer: "fujifilm-f-log2c",
      inputGamut: "fujifilm-f-gamut-c",
      outputTransfer: "srgb",
      outputGamut: "rec709",
      intent: "look",
      family: "fujifilm-film-simulation",
      variant: "eterna",
      contractSource: "source-package-rule",
      contractSourceId: "fujifilm-f-log2c-to-eterna",
      contractConfidence: "high"
    });
  });

  test("does not trust cube comments or loose path hints without a source package rule", async () => {
    const root = await createTempRepo();
    await writeFixture(
      root,
      "imports/ARRI/Look Library/LogC4 Rec709/1110 Black and White.cube",
      [
        "TITLE \"1110 Black and White\"",
        "# LUMAFORGE_INPUT_TRANSFER: arri-logc4",
        "# LUMAFORGE_INPUT_GAMUT: arri-wide-gamut-4",
        "# LUMAFORGE_OUTPUT_TRANSFER: srgb",
        "# LUMAFORGE_OUTPUT_GAMUT: rec709",
        "LUT_3D_SIZE 33"
      ].join("\n") + "\n"
    );

    const result = await importProfiles({
      rootDir: root,
      fromDir: path.join(root, "imports"),
      namespace: "arri",
      author: "ARRI",
      license: "NOASSERTION",
      redistributionAllowed: false,
      now: "2026-04-28T00:00:00.000Z"
    });

    expect(result.written[0]?.entryDir).toBe("profiles/lut.arri.1110-black-and-white.v1");
    const manifest = await readJson<any>(root, "profiles/lut.arri.1110-black-and-white.v1/manifest.json");
    expect(manifest.lut).toMatchObject({
      title: "1110 Black and White",
      dimension: "3d",
      size: 33
    });
    expect(manifest.lut).not.toHaveProperty("inputTransfer");
    expect(manifest.lut).not.toHaveProperty("inputGamut");
    expect(manifest.lut).not.toHaveProperty("outputTransfer");
    expect(manifest.lut).not.toHaveProperty("outputGamut");
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
