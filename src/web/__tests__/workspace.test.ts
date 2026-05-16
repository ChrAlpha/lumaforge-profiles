import { describe, expect, test } from "vitest";

import {
  addLutUploadBatch,
  createWebProfilesWorkspace,
  exportPersistableWorkspace,
  restorePersistedWorkspace,
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
      sourceUrl: "https://profiles.example.test/previous/catalog.json",
      redistributionAllowed: true,
      targets: {},
      assets: [
        {
          role: "cube-lut",
          path: `assets/${id}.cube`,
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
    review: {
      reviewed: true,
      warnings: [],
    },
  };
}

describe("web profiles workspace", () => {
  test("adds multiple LUT upload batches without replacing carried baseline entries", async () => {
    const workspace = createWebProfilesWorkspace({
      baselineEntries: [
        carriedEntry("org.previous.lut.warm", "Previous Warm"),
        carriedEntry("org.previous.lut.cool", "Previous Cool"),
      ],
      now: "2026-05-16T00:00:00.000Z",
    });

    const afterFirstBatch = await addLutUploadBatch(workspace, {
      batchName: "first-upload",
      namespace: "artist",
      now: "2026-05-16T01:00:00.000Z",
      files: [
        {
          name: "Cinema Warm.cube",
          text: 'TITLE "Cinema Warm"\nLUT_3D_SIZE 2\n',
        },
        {
          name: "Cinema Cool.cube",
          text: 'TITLE "Cinema Cool"\nLUT_3D_SIZE 2\n',
        },
      ],
    });

    const afterSecondBatch = await addLutUploadBatch(afterFirstBatch, {
      batchName: "second-upload",
      namespace: "artist",
      now: "2026-05-16T02:00:00.000Z",
      files: [
        {
          name: "Late Night.cube",
          text: 'TITLE "Late Night"\nLUT_3D_SIZE 2\n',
        },
      ],
    });

    expect(afterSecondBatch.entries.map((entry) => entry.id)).toEqual([
      "org.previous.lut.warm",
      "org.previous.lut.cool",
      "org.artist.lut.cinema-warm",
      "org.artist.lut.cinema-cool",
      "org.artist.lut.late-night",
    ]);
    expect(afterSecondBatch.batches.map((batch) => batch.name)).toEqual([
      "first-upload",
      "second-upload",
    ]);
    expect(afterSecondBatch.entries.filter((entry) => entry.status === "carried")).toHaveLength(2);
    expect(afterSecondBatch.entries.filter((entry) => entry.status === "new-draft")).toHaveLength(3);
  });

  test("persists workspace metadata and draft LUT text without persisting publish credentials", async () => {
    const workspace = await addLutUploadBatch(
      createWebProfilesWorkspace({
        baselineEntries: [carriedEntry("org.previous.lut.warm", "Previous Warm")],
        now: "2026-05-16T00:00:00.000Z",
      }),
      {
        batchName: "upload",
        namespace: "artist",
        now: "2026-05-16T01:00:00.000Z",
        files: [
          {
            name: "Cinema Warm.cube",
            text: 'TITLE "Cinema Warm"\nLUT_3D_SIZE 2\n',
          },
        ],
      },
    );

    const persisted = exportPersistableWorkspace(workspace, {
      includeDraftFileText: true,
      credentials: {
        s3AccessKeyId: "AKIA_SHOULD_NOT_PERSIST",
        s3SecretAccessKey: "SECRET_SHOULD_NOT_PERSIST",
        githubToken: "ghp_SHOULD_NOT_PERSIST",
      },
    });
    const serialized = JSON.stringify(persisted);

    expect(serialized).toContain("Previous Warm");
    expect(serialized).toContain("Cinema Warm");
    expect(
      persisted.entries.find((entry) => entry.id === "org.artist.lut.cinema-warm")?.file?.text,
    ).toBe('TITLE "Cinema Warm"\nLUT_3D_SIZE 2\n');
    expect(serialized).not.toContain("AKIA_SHOULD_NOT_PERSIST");
    expect(serialized).not.toContain("SECRET_SHOULD_NOT_PERSIST");
    expect(serialized).not.toContain("ghp_SHOULD_NOT_PERSIST");

    const restored = restorePersistedWorkspace(persisted);
    expect(restored.entries.map((entry) => entry.id)).toEqual([
      "org.previous.lut.warm",
      "org.artist.lut.cinema-warm",
    ]);
  });
});
