import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../app/App";
import {
  createWebProfilesWorkspace,
  exportPersistableWorkspace,
} from "../workspace";

const STORAGE_KEY = "lumaforge-profiles-workspace-v1";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the studio root with a stable test hook", () => {
    const { container } = render(<App />);

    const root = container.querySelector("[data-app-root]");
    expect(root).not.toBeNull();
    expect(screen.getByText(/LumaForge Profiles Studio/i)).toBeInTheDocument();
  });

  it("rehydrates a persisted workspace from localStorage on mount", () => {
    const persisted = exportPersistableWorkspace(
      createWebProfilesWorkspace({ now: "2026-05-16T00:00:00.000Z" }),
      { includeDraftFileText: true },
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));

    render(<App />);

    expect(screen.getByText("No upload batches yet")).toBeInTheDocument();
  });

  it("dispatches an upload batch and renders the new batch + entry", async () => {
    const user = userEvent.setup();

    const promptSpy = vi
      .spyOn(window, "prompt")
      .mockReturnValueOnce("artist");

    render(<App />);

    const file = new File(
      ['TITLE "Cinema Warm"\nLUT_3D_SIZE 2\n'],
      "Cinema Warm.cube",
      { type: "application/x-cube-lut" },
    );

    // The legacy flow creates a hidden <input> and clicks it. Intercept the
    // synthetic click so we can drive the change event with our fixture file.
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(function (this: HTMLInputElement) {
        Object.defineProperty(this, "files", {
          configurable: true,
          value: [file],
        });
        this.dispatchEvent(new Event("change"));
      });

    await user.click(screen.getByRole("button", { name: "Upload LUTs" }));

    await waitFor(() => {
      expect(screen.getByText("Cinema Warm")).toBeInTheDocument();
    });
    expect(screen.getByText(/Imported 1 LUT file/)).toBeInTheDocument();

    // Persistence effect wrote the new workspace to localStorage.
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw).toContain("Cinema Warm");

    promptSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
