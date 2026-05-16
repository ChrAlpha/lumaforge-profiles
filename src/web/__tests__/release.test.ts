import { describe, expect, test } from "vitest";

import { buildBrowserReleasePackage, buildBrowserS3ReleasePlan } from "../release";
import {
  addLutUploadBatch,
  createWebProfilesWorkspace,
  type WebWorkspaceEntry,
} from "../workspace";

function carriedEntry(id: string, title: string, sha256: string): WebWorkspaceEntry {
  return {
    id,
    status: "carried",
    manifest: {
      schemaVersion: 1,
      id,
      kind: "lut",
      format: "cube",
      version: "1.0.0",
      title,
      description: null,
      license: "CC0-1.0",
      author: "Previous maintainer",
      source: "third-party",
      sourceUrl: "https://profiles.example.test/channels/stable/catalog.json",
      redistributionAllowed: true,
      targets: {},
      assets: [
        {
          role: "cube-lut",
          path: `${title}.cube`,
          mediaType: "application/x-cube-lut",
          byteSize: 42,
          sha256,
        },
      ],
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
      lut: {
        title,
        dimension: "3d",
        size: 33,
        inputTransfer: "srgb",
        inputGamut: "rec709",
        outputTransfer: "srgb",
        outputGamut: "rec709",
        intent: "display-look",
      },
    },
    review: {
      reviewed: true,
      warnings: [],
    },
  };
}

describe("browser S3 release plan", () => {
  test("builds the next S3 release from baseline and new reviewed LUTs", async () => {
    const oldHash = "a".repeat(64);
    const uploadedText = 'TITLE "Cinema Warm"\nLUT_3D_SIZE 2\n';
    const workspace = await addLutUploadBatch(
      createWebProfilesWorkspace({
        baselineEntries: [carriedEntry("org.previous.lut.warm", "Previous Warm", oldHash)],
        now: "2026-05-16T00:00:00.000Z",
      }),
      {
        batchName: "upload",
        namespace: "artist",
        now: "2026-05-16T01:00:00.000Z",
        files: [{ name: "Cinema Warm.cube", text: uploadedText }],
      },
    );
    const reviewedWorkspace = {
      ...workspace,
      entries: workspace.entries.map((entry) =>
        entry.status === "new-draft"
          ? {
              ...entry,
              manifest: {
                ...entry.manifest,
                license: "CC0-1.0",
                author: "Artist",
                redistributionAllowed: true,
                lut: {
                  ...entry.manifest.lut,
                  inputTransfer: "srgb",
                  inputGamut: "rec709",
                  outputTransfer: "srgb",
                  outputGamut: "rec709",
                  intent: "display-look" as const,
                },
              },
              review: { reviewed: true, warnings: [] },
            }
          : entry,
      ),
    };

    const plan = buildBrowserS3ReleasePlan(reviewedWorkspace, {
      tag: "v2026.05.16",
      publicBaseUrl: "https://profiles.example.test",
      channels: ["stable"],
      existingBlobKeys: [
        "blobs/sha256/aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.cube",
      ],
      generatedAt: "2026-05-16T02:00:00.000Z",
    });

    expect(plan.catalog.entries.map((entry) => entry.id)).toEqual([
      "org.previous.lut.warm",
      "org.artist.lut.cinema-warm",
    ]);
    expect(plan.objects.filter((object) => object.phase === "blob").map((object) => object.action)).toEqual([
      "skip",
      "upload",
    ]);
    expect(plan.objects.at(-2)?.key).toBe("channels/stable/catalog.json");
    expect(plan.objects.at(-1)?.key).toBe("channels/stable/release.json");
  });

  test("exports release package artifacts instead of a workspace snapshot", async () => {
    const workspace = await addLutUploadBatch(
      createWebProfilesWorkspace({ now: "2026-05-16T00:00:00.000Z" }),
      {
        batchName: "upload",
        namespace: "artist",
        now: "2026-05-16T01:00:00.000Z",
        files: [{ name: "Cinema Warm.cube", text: 'TITLE "Cinema Warm"\nLUT_3D_SIZE 2\n' }],
      },
    );
    const reviewedWorkspace = {
      ...workspace,
      entries: workspace.entries.map((entry) => ({
        ...entry,
        manifest: {
          ...entry.manifest,
          license: "CC0-1.0",
          author: "Artist",
          redistributionAllowed: true,
          lut: {
            ...entry.manifest.lut,
            inputTransfer: "srgb",
            inputGamut: "rec709",
            outputTransfer: "srgb",
            outputGamut: "rec709",
            intent: "display-look" as const,
          },
        },
        review: { reviewed: true, warnings: [] },
      })),
    };

    const releasePackage = buildBrowserReleasePackage(reviewedWorkspace, {
      tag: "v2026.05.16",
      publicBaseUrl: "https://profiles.example.test",
      channels: ["stable"],
      generatedAt: "2026-05-16T02:00:00.000Z",
    });
    const serialized = JSON.stringify(releasePackage);

    expect(releasePackage.files.map((file) => file.path)).toEqual([
      "catalog.json",
      "release.json",
      "blobs-manifest.json",
      "publish-plan.json",
      "entries/org.artist.lut.cinema-warm.json",
      "blobs/sha256/7d/9a/7d9a9a7da6bc3c6ec9879f6ae106236e69f71a9cfc0a86e2fc73f62c26a25b67.cube",
    ]);
    expect(serialized).toContain("Cinema Warm");
    expect(serialized).toContain('TITLE \\"Cinema Warm\\"');
    expect(serialized).not.toContain("s3AccessKeyId");
    expect(serialized).not.toContain("githubToken");
    const publishPlan = JSON.parse(
      releasePackage.files.find((file) => file.path === "publish-plan.json")!.body,
    ) as { objects: Array<{ key: string; localPath: string }> };
    expect(publishPlan.objects.map((object) => [object.key, object.localPath])).toContainEqual([
      "releases/v2026.05.16/blobs-manifest.json",
      "blobs-manifest.json",
    ]);
  });
});
