import { describe, expect, test } from "vitest";

import { renderWorkspaceShell } from "../ui";
import {
  addLutUploadBatch,
  createWebProfilesWorkspace,
  type WebWorkspaceEntry,
} from "../workspace";

function carriedEntry(id: string, title: string): WebWorkspaceEntry {
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
          path: "assets/previous.cube",
          mediaType: "application/x-cube-lut",
          byteSize: 42,
          sha256: "a".repeat(64),
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
    review: { reviewed: true, warnings: [] },
  };
}

describe("web UI shell", () => {
  test("renders baseline, uploaded batches, metadata preview, and memory-only publish controls", async () => {
    const workspace = await addLutUploadBatch(
      createWebProfilesWorkspace({
        baselineEntries: [carriedEntry("org.previous.lut.warm", "Previous Warm")],
        now: "2026-05-16T00:00:00.000Z",
      }),
      {
        batchName: "upload",
        namespace: "artist",
        now: "2026-05-16T01:00:00.000Z",
        files: [{ name: "Cinema Warm.cube", text: 'TITLE "Cinema Warm"\nLUT_3D_SIZE 2\n' }],
      },
    );

    const html = renderWorkspaceShell(workspace);

    expect(html).toContain("LumaForge Profiles Studio");
    expect(html).toContain("Previous Warm");
    expect(html).toContain("Cinema Warm");
    expect(html).toContain("upload");
    expect(html).toContain("Manifest preview");
    expect(html).toContain("Build S3/R2 plan");
    expect(html).toContain("Export release package");
    expect(html).toContain("Publish GitHub Release");
    expect(html).toContain("Credentials stay in memory only");
  });
});
