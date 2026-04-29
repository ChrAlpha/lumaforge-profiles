import fs from "node:fs/promises";
import path from "node:path";

import { importProfiles } from "../src/import/write-entry";
import { buildReleaseProfiles } from "../src/release/build";
import { sha256File } from "../src/utils/hash";
import { createTempRepo, readJson, writeFixture, writeProfileEntry } from "./helpers";

describe("single-asset release build", () => {
  test("builds an index-first release with one GitHub asset per LUT, DCP, and LCP", async () => {
    const root = await createTempRepo();
    const lut = await writeProfileEntry(root, {
      id: "org.lumaforge.lut.neutral-rec709",
      entryDir: "profiles/lut.lumaforge.neutral-rec709.v1",
      title: "Neutral Rec.709",
      assetFileName: "neutral-rec709.cube",
      assetContent: "TITLE \"Neutral Rec.709\"\n"
    });
    const dcp = await writeProfileEntry(root, {
      id: "org.lumaforge.camera.sony.ilce-7m4",
      entryDir: "profiles/camera.sony.ilce-7m4.v1",
      kind: "camera-profile",
      format: "dcp",
      title: "Sony ILCE-7M4 Standard",
      assetFileName: "standard.dcp",
      assetContent: "fake dcp profile\n"
    });
    const lcp = await writeProfileEntry(root, {
      id: "org.lumaforge.lens.sony.fe-24-70mm-f2-8-gm-ii",
      entryDir: "profiles/lens.sony.fe-24-70mm-f2-8-gm-ii.v1",
      kind: "lens-correction-profile",
      format: "lcp",
      title: "Sony FE 24-70mm F2.8 GM II",
      assetFileName: "profile.lcp",
      assetContent: "<lensprofile><model>FE 24-70mm F2.8 GM II</model></lensprofile>\n"
    });

    const result = await buildReleaseProfiles({
      rootDir: root,
      tag: "v2026.04.28",
      repo: "lumaforge/lumaforge-profiles",
      now: "2026-04-28T00:00:00.000Z"
    });

    expect(result.outputDir).toBe(path.join(root, "dist", "release", "v2026.04.28"));
    expect(result.releaseAssets.map((asset) => asset.releaseAssetName).sort()).toEqual([
      "asset.camera.sony.ilce-7m4.v1.dcp",
      "asset.lens.sony.fe-24-70mm-f2-8-gm-ii.v1.lcp",
      "asset.lut.lumaforge.neutral-rec709.v1.cube"
    ]);
    expect((await fs.readdir(path.join(result.outputDir, "assets"))).sort()).toEqual([
      "asset.camera.sony.ilce-7m4.v1.dcp",
      "asset.lens.sony.fe-24-70mm-f2-8-gm-ii.v1.lcp",
      "asset.lut.lumaforge.neutral-rec709.v1.cube"
    ]);
    expect((await fs.readdir(path.join(result.outputDir, "entries"))).sort()).toEqual([
      "entry.camera.sony.ilce-7m4.v1.manifest.json",
      "entry.lens.sony.fe-24-70mm-f2-8-gm-ii.v1.manifest.json",
      "entry.lut.lumaforge.neutral-rec709.v1.manifest.json"
    ]);
    expect(await findFiles(result.outputDir, ".zip")).toEqual([]);

    const index = await readJson<any>(root, "dist/release/v2026.04.28/lumaforge-profiles.v2026.04.28.index.json");
    expect(index).toMatchObject({
      schemaVersion: 1,
      id: "org.lumaforge.profiles",
      version: "v2026.04.28",
      release: {
        provider: "github",
        owner: "lumaforge",
        repo: "lumaforge-profiles",
        tag: "v2026.04.28"
      }
    });
    expect(index.entries.map((entry: any) => entry.kind).sort()).toEqual([
      "camera-profile",
      "lens-correction-profile",
      "lut"
    ]);
    expect(index.entries.flatMap((entry: any) => entry.assets.map((asset: any) => asset.download.url))).toEqual(
      expect.arrayContaining([
        "https://github.com/lumaforge/lumaforge-profiles/releases/download/v2026.04.28/asset.lut.lumaforge.neutral-rec709.v1.cube",
        "https://github.com/lumaforge/lumaforge-profiles/releases/download/v2026.04.28/asset.camera.sony.ilce-7m4.v1.dcp",
        "https://github.com/lumaforge/lumaforge-profiles/releases/download/v2026.04.28/asset.lens.sony.fe-24-70mm-f2-8-gm-ii.v1.lcp"
      ])
    );
    expect(index.entries.flatMap((entry: any) => entry.assets.map((asset: any) => asset.download.url))).not.toEqual(
      expect.arrayContaining([expect.stringContaining(".zip")])
    );

    const indexedAssets = new Map(
      index.entries.flatMap((entry: any) =>
        entry.assets.map((asset: any) => [asset.releaseAssetName, asset])
      )
    );
    expect(indexedAssets.get("asset.lut.lumaforge.neutral-rec709.v1.cube")).toMatchObject({
      role: "cube-lut",
      mediaType: "application/x-cube-lut",
      originalPath: "assets/neutral-rec709.cube",
      size: lut.byteSize,
      sha256: lut.sha256,
      download: {
        type: "github-release-asset"
      }
    });
    expect(indexedAssets.get("asset.camera.sony.ilce-7m4.v1.dcp")).toMatchObject({
      role: "dcp",
      mediaType: "application/x-adobe-dng-camera-profile",
      size: dcp.byteSize,
      sha256: dcp.sha256
    });
    expect(indexedAssets.get("asset.lens.sony.fe-24-70mm-f2-8-gm-ii.v1.lcp")).toMatchObject({
      role: "lcp",
      mediaType: "application/x-adobe-lens-correction-profile",
      size: lcp.byteSize,
      sha256: lcp.sha256
    });

    const checksums = await fs.readFile(path.join(result.outputDir, "lumaforge-profiles.v2026.04.28.checksums.txt"), "utf8");
    expect(checksums).toContain("assets/asset.lut.lumaforge.neutral-rec709.v1.cube");
    expect(checksums).toContain("entries/entry.camera.sony.ilce-7m4.v1.manifest.json");
    expect(checksums).toContain("lumaforge-profiles.v2026.04.28.index.json");
  });

  test("builds release output from imported complex local asset trees", async () => {
    const root = await createTempRepo();
    await writeFixture(root, "local-assets/LUTs/film/cinematic-rec709.cube", "TITLE \"Cinematic Rec.709\"\n");

    await importProfiles({
      rootDir: root,
      fromDir: path.join(root, "local-assets"),
      namespace: "lumaforge",
      author: "LumaForge contributors",
      license: "CC0-1.0",
      redistributionAllowed: true,
      now: "2026-04-28T00:00:00.000Z"
    });

    const result = await buildReleaseProfiles({
      rootDir: root,
      tag: "v2026.04.28",
      repo: "lumaforge/lumaforge-profiles",
      now: "2026-04-28T00:00:00.000Z"
    });

    expect(result.releaseAssets.map((asset) => asset.releaseAssetName)).toEqual([
      "asset.lut.lumaforge.cinematic-rec709.v1.cube"
    ]);
    const index = await readJson<any>(root, "dist/release/v2026.04.28/lumaforge-profiles.v2026.04.28.index.json");
    expect(index.entries[0].assets[0]).toMatchObject({
      releaseAssetName: "asset.lut.lumaforge.cinematic-rec709.v1.cube",
      download: {
        url: "https://github.com/lumaforge/lumaforge-profiles/releases/download/v2026.04.28/asset.lut.lumaforge.cinematic-rec709.v1.cube"
      }
    });
  });

  test("fails fast when deterministic release asset names collide", async () => {
    const root = await createTempRepo();
    const entryDir = "profiles/lut.lumaforge.multi.v1";
    const firstAssetPath = await writeFixture(root, `${entryDir}/assets/a.cube`, "same bytes\n");
    const secondAssetPath = await writeFixture(root, `${entryDir}/assets/b.cube`, "same bytes\n");
    const sha256 = await sha256File(firstAssetPath);
    const byteSize = (await fs.stat(firstAssetPath)).size;
    expect(await sha256File(secondAssetPath)).toBe(sha256);
    await writeFixture(
      root,
      `${entryDir}/manifest.json`,
      JSON.stringify(
        {
          schemaVersion: 1,
          id: "org.lumaforge.lut.multi",
          kind: "lut",
          format: "cube",
          version: "1.0.0",
          title: "Multi",
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
              path: "assets/a.cube",
              mediaType: "application/x-cube-lut",
              byteSize,
              sha256
            },
            {
              role: "cube-lut",
              path: "assets/b.cube",
              mediaType: "application/x-cube-lut",
              byteSize,
              sha256
            }
          ],
          createdAt: "2026-04-28T00:00:00.000Z",
          updatedAt: "2026-04-28T00:00:00.000Z"
        },
        null,
        2
      )
    );

    await expect(
      buildReleaseProfiles({
        rootDir: root,
        tag: "v2026.04.28",
        repo: "lumaforge/lumaforge-profiles"
      })
    ).rejects.toThrow(/release asset name collision/i);
  });

  test("rejects non-redistributable, incomplete provenance, empty, and escaping assets before publishing", async () => {
    const root = await createTempRepo();
    await writeProfileEntry(root, {
      id: "org.lumaforge.lut.unsafe",
      entryDir: "profiles/lut.lumaforge.unsafe.v1",
      redistributionAllowed: false
    });
    await writeProfileEntry(root, {
      id: "org.lumaforge.lut.incomplete",
      entryDir: "profiles/lut.lumaforge.incomplete.v1",
      license: "",
      author: "",
      source: " "
    });
    await writeProfileEntry(root, {
      id: "org.lumaforge.lut.empty",
      entryDir: "profiles/lut.lumaforge.empty.v1",
      assetFileName: "empty.cube",
      assetContent: ""
    });
    await writeFixture(root, "outside.cube", "TITLE \"outside\"\n");
    await writeFixture(
      root,
      "profiles/lut.lumaforge.escape.v1/manifest.json",
      JSON.stringify(
        {
          schemaVersion: 1,
          id: "org.lumaforge.lut.escape",
          kind: "lut",
          format: "cube",
          version: "1.0.0",
          title: "Escape",
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
              path: "../outside.cube",
              mediaType: "application/x-cube-lut",
              byteSize: 16,
              sha256: "0".repeat(64)
            }
          ],
          createdAt: "2026-04-28T00:00:00.000Z",
          updatedAt: "2026-04-28T00:00:00.000Z"
        },
        null,
        2
      )
    );

    await expect(
      buildReleaseProfiles({
        rootDir: root,
        tag: "v2026.04.28",
        repo: "lumaforge/lumaforge-profiles"
      })
    ).rejects.toThrow(/release-redistribution|release-license|release-author|release-source|asset-empty|asset-path/);
  });
});

async function findFiles(root: string, extension: string) {
  const results: string[] = [];
  async function walk(directory: string) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.name.endsWith(extension)) {
        results.push(path.relative(root, absolutePath));
      }
    }
  }
  await walk(root);
  return results.sort();
}
