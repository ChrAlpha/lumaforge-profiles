import { describe, expect, test } from "vitest";

import {
  addLutUploadBatch,
  createWebProfilesWorkspace,
  exportPersistableWorkspace,
  restorePersistedWorkspace,
  type WebWorkspaceEntry,
} from "../workspace";
import {
  initialWorkspaceState,
  workspaceReducer,
  type WorkspaceAction,
} from "../app/workspace-reducer";

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

describe("workspace reducer", () => {
  test("initialWorkspaceState builds an empty workspace at the provided now", () => {
    const state = initialWorkspaceState("2026-05-16T00:00:00.000Z");

    expect(state).toEqual(
      createWebProfilesWorkspace({ now: "2026-05-16T00:00:00.000Z" }),
    );
  });

  test("restore replaces state with restorePersistedWorkspace output", async () => {
    const source = await addLutUploadBatch(
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
    const persisted = exportPersistableWorkspace(source, {
      includeDraftFileText: true,
    });

    const next = workspaceReducer(
      initialWorkspaceState("2000-01-01T00:00:00.000Z"),
      { type: "restore", persisted },
    );

    expect(next).toEqual(restorePersistedWorkspace(persisted));
  });

  test("load-baseline replaces state with a fresh workspace from carried entries", () => {
    const baselineEntries = [
      carriedEntry("org.previous.lut.warm", "Previous Warm"),
      carriedEntry("org.previous.lut.cool", "Previous Cool"),
    ];

    const next = workspaceReducer(
      initialWorkspaceState("2000-01-01T00:00:00.000Z"),
      {
        type: "load-baseline",
        baselineEntries,
        now: "2026-05-16T00:00:00.000Z",
      },
    );

    expect(next).toEqual(
      createWebProfilesWorkspace({
        baselineEntries,
        now: "2026-05-16T00:00:00.000Z",
      }),
    );
    expect(next.batches).toEqual([]);
    expect(next.createdAt).toBe("2026-05-16T00:00:00.000Z");
    expect(next.updatedAt).toBe("2026-05-16T00:00:00.000Z");
  });

  test("set-workspace replaces state with the provided workspace verbatim", async () => {
    const computed = await addLutUploadBatch(
      createWebProfilesWorkspace({ now: "2026-05-16T00:00:00.000Z" }),
      {
        batchName: "upload",
        namespace: "artist",
        now: "2026-05-16T01:00:00.000Z",
        files: [
          {
            name: "Late Night.cube",
            text: 'TITLE "Late Night"\nLUT_3D_SIZE 2\n',
          },
        ],
      },
    );

    const next = workspaceReducer(
      initialWorkspaceState("2000-01-01T00:00:00.000Z"),
      { type: "set-workspace", workspace: computed },
    );

    expect(next).toBe(computed);
  });

  test("export then restore round-trips to a structurally equivalent state", async () => {
    const start = await addLutUploadBatch(
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

    const persisted = exportPersistableWorkspace(start, {
      includeDraftFileText: true,
    });
    const restored = workspaceReducer(start, { type: "restore", persisted });

    expect(restored).toEqual(start);
  });

  test("does not mutate the prior state on a transition", () => {
    const prev = initialWorkspaceState("2026-05-16T00:00:00.000Z");
    const snapshot = structuredClone(prev);

    workspaceReducer(prev, {
      type: "load-baseline",
      baselineEntries: [carriedEntry("org.previous.lut.warm", "Previous Warm")],
      now: "2026-06-01T00:00:00.000Z",
    });

    expect(prev).toEqual(snapshot);
  });

  test("ignores an action whose type is not recognized and returns prior state", () => {
    const state = initialWorkspaceState("2026-05-16T00:00:00.000Z");

    const next = workspaceReducer(
      state,
      { type: "noop" } as unknown as WorkspaceAction,
    );

    expect(next).toBe(state);
  });
});
