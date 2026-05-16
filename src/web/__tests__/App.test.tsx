import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { App } from "../app/App";
import {
  createWebProfilesWorkspace,
  exportPersistableWorkspace,
} from "../workspace";
import { buildBrowserReleasePackage } from "../release";
import { publishBrowserS3ReleasePackage } from "../publish";

vi.mock("../release", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../release")>();
  return { ...actual, buildBrowserReleasePackage: vi.fn() };
});

vi.mock("../publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../publish")>();
  return { ...actual, publishBrowserS3ReleasePackage: vi.fn() };
});

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

  it("does not persist the boot workspace before any user interaction (StrictMode-safe)", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it("rehydrates a persisted workspace from localStorage on mount", () => {
    const persisted = exportPersistableWorkspace(
      createWebProfilesWorkspace({ now: "2026-05-16T00:00:00.000Z" }),
      { includeDraftFileText: true },
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<App />);

    expect(screen.getByText("No upload batches yet")).toBeInTheDocument();
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it("dispatches an upload batch and renders the new batch + entry", async () => {
    const user = userEvent.setup();

    const promptSpy = vi.spyOn(window, "prompt");

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

    // A Radix dialog (not window.prompt) collects the namespace.
    const dialog = await screen.findByRole("dialog", {
      name: "Upload LUTs",
    });
    const namespace = screen.getByLabelText("Namespace for generated ids");
    expect(namespace).toHaveValue("local");
    await user.clear(namespace);
    await user.type(namespace, "artist");
    await user.click(
      screen.getByRole("button", { name: "Submit" }),
    );

    await waitFor(() => {
      // Title renders in both the entry table and the manifest switcher tab.
      expect(screen.getAllByText("Cinema Warm").length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/Imported 1 LUT file/)).toBeInTheDocument();
    expect(dialog).not.toBeInTheDocument();

    // Persistence effect wrote the new workspace to localStorage.
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw).toContain("Cinema Warm");

    // The legacy window.prompt path is fully retired.
    expect(promptSpy).not.toHaveBeenCalled();

    promptSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it("cancelling the upload dialog aborts without dispatching a batch", async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, "prompt");

    render(<App />);

    const file = new File(
      ['TITLE "Cinema Warm"\nLUT_3D_SIZE 2\n'],
      "Cinema Warm.cube",
      { type: "application/x-cube-lut" },
    );
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
    await screen.findByRole("dialog", { name: "Upload LUTs" });
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Cinema Warm")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(promptSpy).not.toHaveBeenCalled();

    promptSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it("loads baseline entries from a catalog URL collected via the dialog", async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, "prompt");

    const entryDoc = {
      id: "vendor/look",
      kind: "lut",
      format: "cube",
      version: "1.0.0",
      title: "Vendor Look",
      description: null,
      license: "MIT",
      author: "Vendor",
      source: "vendor",
      sourceUrl: null,
      redistributionAllowed: true,
      targets: {},
      assets: [],
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T00:00:00.000Z",
    };
    const catalog = {
      entries: [
        {
          id: "vendor/look",
          title: "Vendor Look",
          entryUrl: "https://cdn.example.com/vendor/look.json",
        },
      ],
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.includes("look.json") ? entryDoc : catalog;
        return new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
        });
      });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Load baseline" }));
    await screen.findByRole("dialog", { name: "Load baseline" });
    await user.type(
      screen.getByLabelText("S3/R2 channel or release catalog URL"),
      "https://cdn.example.com/catalog.json",
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      // Title renders in both the entry table and the manifest switcher tab.
      expect(screen.getAllByText("Vendor Look").length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/Loaded 1 baseline entries/)).toBeInTheDocument();
    expect(promptSpy).not.toHaveBeenCalled();

    promptSpy.mockRestore();
    fetchSpy.mockRestore();
  });

  it("publishes to S3/R2 even when the region field is cleared (legacy parity)", async () => {
    const user = userEvent.setup();

    vi.mocked(buildBrowserReleasePackage).mockReturnValue({
      tag: "v2026.05.16",
    } as unknown as ReturnType<typeof buildBrowserReleasePackage>);
    vi.mocked(publishBrowserS3ReleasePackage).mockResolvedValue({
      uploaded: ["a"],
      skipped: [],
    } as unknown as Awaited<
      ReturnType<typeof publishBrowserS3ReleasePackage>
    >);

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Publish S3/R2" }));

    // First dialog: release package details (tag + public base URL defaults).
    await screen.findByRole("dialog", { name: "Release package details" });
    await user.click(screen.getByRole("button", { name: "Submit" }));

    // Second dialog: S3/R2 destination + credentials.
    await screen.findByRole("dialog", { name: "Publish to S3/R2" });
    await user.type(screen.getByLabelText("S3/R2 bucket"), "my-bucket");
    // Clear the region field so it submits empty (must NOT block).
    await user.clear(screen.getByLabelText("S3 region"));
    await user.type(
      screen.getByLabelText("S3/R2 access key id"),
      "AKIA-TEST",
    );
    await user.type(
      screen.getByLabelText("S3/R2 secret access key"),
      "secret-test",
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(
        screen.getByText(/Published S3\/R2 release: uploaded 1, skipped 0\./),
      ).toBeInTheDocument();
    });
    expect(publishBrowserS3ReleasePackage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ bucket: "my-bucket", region: "" }),
    );
  });

  it("renders the credential fields masked via SecretField with a reveal toggle", () => {
    render(<App />);

    const s3Key = screen.getByLabelText("S3/R2 access key");
    const ghToken = screen.getByLabelText("GitHub token");
    expect(s3Key).toHaveAttribute("type", "password");
    expect(ghToken).toHaveAttribute("type", "password");

    // Each field exposes a show/hide toggle (default hidden).
    expect(screen.getAllByRole("button", { name: /show/i })).toHaveLength(2);
  });

  it("reveals a credential without persisting the secret to localStorage", async () => {
    const user = userEvent.setup();
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<App />);

    const s3Key = screen.getByLabelText("S3/R2 access key");
    await user.type(s3Key, "AKIA-IN-MEMORY");
    expect(s3Key).toHaveValue("AKIA-IN-MEMORY");

    // The reveal toggle for this field flips it to plain text.
    const toggle = screen.getAllByRole("button", { name: /show/i })[0];
    await user.click(toggle);
    expect(s3Key).toHaveAttribute("type", "text");

    // The secret is never written to localStorage.
    for (const call of setItemSpy.mock.calls) {
      expect(String(call[1])).not.toContain("AKIA-IN-MEMORY");
    }
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
