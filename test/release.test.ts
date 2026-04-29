import { buildGithubReleasePlan, releaseProfiles } from "../src/release/github";
import { createTempRepo, writeFixture } from "./helpers";

describe("GitHub release dry-run", () => {
  test("builds gh commands and summary for individual release assets", async () => {
    const root = await createTempRepo();
    await writeFixture(root, "dist/release/v2026.04.28/lumaforge-profiles.v2026.04.28.index.json", "{}\n");
    await writeFixture(root, "dist/release/v2026.04.28/lumaforge-profiles.v2026.04.28.checksums.txt", "abc  file\n");
    await writeFixture(root, "dist/release/v2026.04.28/assets/asset.lut.lumaforge.safe.v1.cube", "cube bytes");
    await writeFixture(root, "dist/release/v2026.04.28/entries/entry.lut.lumaforge.safe.v1.manifest.json", "{}\n");
    await writeFixture(root, "dist/release/v2026.04.28/RELEASE_NOTES.md", "# Release\n");

    const plan = await buildGithubReleasePlan({
      rootDir: root,
      tag: "v2026.04.28",
      repo: "lumaforge/lumaforge-profiles",
      draft: true,
      dryRun: true
    });

    expect(plan.repo).toBe("lumaforge/lumaforge-profiles");
    expect(plan.indexPath).toMatch(/lumaforge-profiles\.v2026\.04\.28\.index\.json$/);
    expect(plan.assetCount).toBe(4);
    expect(plan.totalBytes).toBeGreaterThan(0);
    expect(plan.assets.map((asset) => asset.replace(root, "<root>")).sort()).toEqual([
      "<root>/dist/release/v2026.04.28/assets/asset.lut.lumaforge.safe.v1.cube",
      "<root>/dist/release/v2026.04.28/entries/entry.lut.lumaforge.safe.v1.manifest.json",
      "<root>/dist/release/v2026.04.28/lumaforge-profiles.v2026.04.28.checksums.txt",
      "<root>/dist/release/v2026.04.28/lumaforge-profiles.v2026.04.28.index.json"
    ]);
    expect(plan.commands.map((command) => command.join(" "))).toEqual([
      expect.stringContaining("gh release view v2026.04.28 --repo lumaforge/lumaforge-profiles"),
      expect.stringContaining("gh release create v2026.04.28"),
      expect.stringContaining("gh release upload v2026.04.28")
    ]);
    expect(plan.commands[1]).toEqual(expect.arrayContaining(["--repo", "lumaforge/lumaforge-profiles"]));
    expect(plan.commands[2]).toEqual(expect.arrayContaining(["--repo", "lumaforge/lumaforge-profiles"]));
  });

  test("dry-run does not execute real gh commands", async () => {
    const root = await createTempRepo();
    await writeFixture(root, "dist/release/v2026.04.28/lumaforge-profiles.v2026.04.28.index.json", "{}\n");
    await writeFixture(root, "dist/release/v2026.04.28/lumaforge-profiles.v2026.04.28.checksums.txt", "abc  file\n");
    await writeFixture(root, "dist/release/v2026.04.28/assets/asset.lut.lumaforge.safe.v1.cube", "cube bytes");
    await writeFixture(root, "dist/release/v2026.04.28/entries/entry.lut.lumaforge.safe.v1.manifest.json", "{}\n");
    await writeFixture(root, "dist/release/v2026.04.28/RELEASE_NOTES.md", "# Release\n");
    const calls: string[][] = [];

    const result = await releaseProfiles({
      rootDir: root,
      tag: "v2026.04.28",
      repo: "lumaforge/lumaforge-profiles",
      dryRun: true,
      runner: async (command, args) => {
        calls.push([command, ...args]);
      }
    });

    expect(calls).toEqual([]);
    expect(result.dryRun).toBe(true);
    expect(result.commands.length).toBeGreaterThan(0);
  });
});
