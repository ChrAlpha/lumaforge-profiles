import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { App } from "../app/App";
import {
  addLutUploadBatch,
  createWebProfilesWorkspace,
  exportPersistableWorkspace,
  type WebWorkspaceEntry,
} from "../workspace";

const STORAGE_KEY = "lumaforge-profiles-workspace-v1";

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

async function seedPersistedWorkspace() {
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
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(exportPersistableWorkspace(workspace, { includeDraftFileText: true })),
  );
}

describe("web UI shell", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  test("renders baseline, uploaded batches, metadata preview, and memory-only publish controls", async () => {
    await seedPersistedWorkspace();

    render(<App />);

    expect(screen.getByText("LumaForge Profiles Studio")).toBeInTheDocument();
    // Titles now appear both in the entry table and the manifest switcher tabs.
    expect(screen.getAllByText("Previous Warm").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cinema Warm").length).toBeGreaterThan(0);

    const batchList = screen.getByRole("list", { name: /upload batches/i });
    expect(within(batchList).getByText("upload")).toBeInTheDocument();
    expect(within(batchList).getByText("1 LUT")).toBeInTheDocument();

    expect(screen.getByText("Manifest preview")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Build S3/R2 plan" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export release package" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish GitHub Release" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Credentials stay in memory only."),
    ).toBeInTheDocument();
  });
});
