import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MetadataPanel } from "../app/components/panels/MetadataPanel";
import {
  createWebProfilesWorkspace,
  type WebProfilesWorkspace,
  type WebWorkspaceEntry,
} from "../workspace";

function entry(id: string, title: string): WebWorkspaceEntry {
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
      author: "Author",
      source: "test",
      sourceUrl: null,
      redistributionAllowed: true,
      targets: {},
      assets: [],
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T00:00:00.000Z",
    },
    review: { reviewed: true, warnings: [] },
  };
}

function workspaceWith(entries: WebWorkspaceEntry[]): WebProfilesWorkspace {
  return { ...createWebProfilesWorkspace(), entries };
}

afterEach(cleanup);

describe("MetadataPanel manifest switcher", () => {
  it("defaults to the first entry's manifest JSON", () => {
    render(
      <MetadataPanel
        workspace={workspaceWith([entry("first", "First"), entry("second", "Second")])}
      />,
    );

    const pre = screen.getByText(/"id": "first"/);
    expect(pre).toBeInTheDocument();
    expect(screen.queryByText(/"id": "second"/)).not.toBeInTheDocument();
  });

  it("switches the previewed manifest when another entry is selected", async () => {
    const user = userEvent.setup();
    render(
      <MetadataPanel
        workspace={workspaceWith([entry("first", "First"), entry("second", "Second")])}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Second" }));

    expect(screen.getByText(/"id": "second"/)).toBeInTheDocument();
    expect(screen.queryByText(/"id": "first"/)).not.toBeInTheDocument();
  });

  it("handles an empty workspace like before (placeholder, no switcher)", () => {
    render(<MetadataPanel workspace={workspaceWith([])} />);

    expect(screen.getByText("Manifest preview")).toBeInTheDocument();
    expect(screen.getByText("{}")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
