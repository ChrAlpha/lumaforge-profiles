import fs from "node:fs/promises";
import path from "node:path";

import { packProfiles } from "../src/pack/pack";
import { sha256File } from "../src/utils/hash";
import { createTempRepo, readJson, writeFixture } from "./helpers";

async function writeSafeEntry(root: string, id: string, entryDir: string, kind = "lut", format = "cube", role = "cube-lut") {
  const fileName = `${id.split(".").pop()}.${format}`;
  const assetContent = kind === "lut" ? "TITLE \"safe\"\n" : `fake ${format}\n`;
  const assetPath = await writeFixture(root, `${entryDir}/assets/${fileName}`, assetContent);
  const manifest = {
    schemaVersion: 1,
    id,
    kind,
    format,
    version: "1.0.0",
    title: id,
    description: null,
    license: "CC0-1.0",
    author: "LumaForge contributors",
    source: "original",
    sourceUrl: null,
    redistributionAllowed: true,
    targets: {},
    assets: [
      {
        role,
        path: `assets/${fileName}`,
        mediaType: "application/octet-stream",
        byteSize: (await fs.stat(assetPath)).size,
        sha256: await sha256File(assetPath)
      }
    ],
    createdAt: "2026-04-28T00:00:00.000Z",
    updatedAt: "2026-04-28T00:00:00.000Z"
  };
  await writeFixture(root, `${entryDir}/manifest.json`, JSON.stringify(manifest, null, 2));
}

describe("release pack generation", () => {
  test("creates zip packs, release manifest, checksums, and release notes", async () => {
    const root = await createTempRepo();
    await writeSafeEntry(root, "org.lumaforge.lut.safe", "profiles/lut.lumaforge.safe.v1");
    await writeSafeEntry(
      root,
      "org.lumaforge.camera.safe",
      "profiles/camera.lumaforge.safe.v1",
      "camera-profile",
      "dcp",
      "dng-camera-profile"
    );

    const result = await packProfiles({
      rootDir: root,
      tag: "profiles-test",
      packs: ["all", "luts", "dcp"],
      now: "2026-04-28T00:00:00.000Z"
    });

    expect(result.outputDir).toBe(path.join(root, "dist", "release", "profiles-test"));
    expect(result.packs.map((pack) => pack.fileName).sort()).toEqual([
      "lumaforge-profiles-profiles-test-all.zip",
      "lumaforge-profiles-profiles-test-dcp.zip",
      "lumaforge-profiles-profiles-test-luts.zip"
    ]);
    for (const pack of result.packs) {
      const zipPath = path.join(result.outputDir, pack.fileName);
      expect((await fs.stat(zipPath)).size).toBeGreaterThan(0);
      expect(pack.sha256).toBe(await sha256File(zipPath));
    }

    const releaseManifest = await readJson<any>(root, "dist/release/profiles-test/release-manifest.json");
    expect(releaseManifest.tag).toBe("profiles-test");
    expect(releaseManifest.packs).toHaveLength(3);
    expect(await fs.readFile(path.join(result.outputDir, "SHA256SUMS"), "utf8")).toContain("lumaforge-profiles-profiles-test-all.zip");
    expect(await fs.readFile(path.join(result.outputDir, "RELEASE_NOTES.md"), "utf8")).toContain("profiles-test");
  });

  test("refuses to pack release-unsafe entries", async () => {
    const root = await createTempRepo();
    await writeSafeEntry(root, "org.lumaforge.lut.unsafe", "profiles/lut.lumaforge.unsafe.v1");
    const manifestPath = path.join(root, "profiles/lut.lumaforge.unsafe.v1/manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    manifest.redistributionAllowed = false;
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    await expect(packProfiles({ rootDir: root, tag: "profiles-test" })).rejects.toThrow(/release-redistribution/);
  });
});
