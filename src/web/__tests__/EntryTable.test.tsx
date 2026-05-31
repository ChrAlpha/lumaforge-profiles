import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EntryTable } from "../app/components/EntryTable";
import type {
  WebWorkspaceEntry,
  WebWorkspaceEntryStatus,
} from "../workspace";

function entry(
  id: string,
  status: WebWorkspaceEntryStatus,
  warnings: string[],
): WebWorkspaceEntry {
  return {
    id,
    status,
    manifest: {
      schemaVersion: 1,
      id,
      kind: "lut",
      format: "cube",
      version: "1.0.0",
      title: `Title ${id}`,
      description: null,
      license: "CC0-1.0",
      author: "Author",
      source: "test",
      sourceUrl: null,
      redistributionAllowed: true,
      targets: {},
      assets: [
        {
          role: "cube-lut",
          path: `assets/${id}.cube`,
          mediaType: "application/x-cube-lut",
          byteSize: 10,
          sha256: "b".repeat(64),
        },
      ],
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T00:00:00.000Z",
    },
    review: { reviewed: warnings.length === 0, warnings },
  };
}

const ALL_STATUSES: WebWorkspaceEntryStatus[] = [
  "carried",
  "new-draft",
  "metadata-changed",
  "duplicate-asset",
  "validation-error",
  "ready",
];

afterEach(cleanup);

describe("EntryTable status badge", () => {
  it("renders an actionable empty state instead of bare headers when there are no entries", () => {
    render(<EntryTable entries={[]} />);

    expect(
      screen.getByText(
        "No LUT entries yet. Load baseline or upload LUTs to begin.",
      ),
    ).toBeInTheDocument();
  });

  it("renders each status as a badge whose accessible text contains the status", () => {
    render(
      <EntryTable
        entries={ALL_STATUSES.map((status, index) =>
          entry(`e${index}`, status, []),
        )}
      />,
    );

    for (const status of ALL_STATUSES) {
      const badge = document.querySelector(`[data-status="${status}"]`);
      expect(badge).not.toBeNull();
      // Distinguishable without color: human text mentions the status.
      expect(badge?.textContent ?? "").toMatch(
        new RegExp(status.replace("-", "[ -]?"), "i"),
      );
    }
  });

  it("keeps a stable data-status attribute distinguishing problem vs calm states", () => {
    render(
      <EntryTable
        entries={[
          entry("ok", "ready", []),
          entry("bad", "validation-error", []),
        ]}
      />,
    );

    const calm = document.querySelector('[data-status="ready"]');
    const problem = document.querySelector('[data-status="validation-error"]');
    expect(calm).not.toBeNull();
    expect(problem).not.toBeNull();
    expect(calm?.getAttribute("data-status")).not.toBe(
      problem?.getAttribute("data-status"),
    );
  });

  it("still renders the original title/batch columns", () => {
    render(<EntryTable entries={[entry("a", "carried", [])]} />);
    expect(screen.getByText("Title a")).toBeInTheDocument();
    expect(screen.getByText("baseline")).toBeInTheDocument();
  });
});

describe("EntryTable warnings tooltip", () => {
  it("shows a warnings trigger whose accessible name reflects the count and reveals warning text on focus", async () => {
    const user = userEvent.setup();
    render(
      <EntryTable
        entries={[
          entry("warned", "new-draft", [
            "License requires review.",
            "Contract requires review.",
          ]),
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: /2 warnings/i });
    expect(trigger).toBeInTheDocument();

    await user.tab();
    // Radix Tooltip renders both a visible and a visually-hidden (a11y) copy;
    // assert presence via the find-all variant.
    expect(
      (await screen.findAllByText(/License requires review\./)).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Contract requires review\./).length,
    ).toBeGreaterThan(0);
  });

  it("shows the no-warning treatment and no warnings trigger when there are none", () => {
    render(<EntryTable entries={[entry("clean", "carried", [])]} />);
    const row = screen.getByText("Title clean").closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Ready")).toBeInTheDocument();
    expect(
      within(row as HTMLElement).queryByRole("button", { name: /warning/i }),
    ).not.toBeInTheDocument();
  });
});
