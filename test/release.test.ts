import { buildGithubReleasePlan, releaseProfiles } from "../src/release/github";
import { createTempRepo, writeFixture } from "./helpers";

describe("GitHub release dry-run", () => {
  test("builds gh commands for release assets", async () => {
    const root = await createTempRepo();
    await writeFixture(root, "dist/release/profiles-test/lumaforge-profiles-profiles-test-all.zip", "zip bytes");
    await writeFixture(root, "dist/release/profiles-test/release-manifest.json", "{}\n");
    await writeFixture(root, "dist/release/profiles-test/SHA256SUMS", "abc  file\n");
    await writeFixture(root, "dist/release/profiles-test/RELEASE_NOTES.md", "# Release\n");

    const plan = await buildGithubReleasePlan({
      rootDir: root,
      tag: "profiles-test",
      draft: true,
      dryRun: true
    });

    expect(plan.commands.map((command) => command.join(" "))).toEqual([
      expect.stringContaining("gh release view profiles-test"),
      expect.stringContaining("gh release create profiles-test"),
      expect.stringContaining("gh release upload profiles-test")
    ]);
  });

  test("dry-run does not execute real gh commands", async () => {
    const root = await createTempRepo();
    await writeFixture(root, "dist/release/profiles-test/lumaforge-profiles-profiles-test-all.zip", "zip bytes");
    await writeFixture(root, "dist/release/profiles-test/release-manifest.json", "{}\n");
    await writeFixture(root, "dist/release/profiles-test/SHA256SUMS", "abc  file\n");
    await writeFixture(root, "dist/release/profiles-test/RELEASE_NOTES.md", "# Release\n");
    const calls: string[][] = [];

    const result = await releaseProfiles({
      rootDir: root,
      tag: "profiles-test",
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
