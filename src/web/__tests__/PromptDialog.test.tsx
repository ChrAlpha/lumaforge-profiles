import { useEffect, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PromptDialog } from "../app/components/PromptDialog";
import { usePromptDialog } from "../app/components/usePromptDialog";

describe("PromptDialog", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the title and labelled fields with defaults", () => {
    render(
      <PromptDialog
        open
        title="Build release plan"
        fields={[
          { name: "tag", label: "Release tag", defaultValue: "v2026.05.16" },
          {
            name: "publicBaseUrl",
            label: "Public base URL",
            defaultValue: "https://profiles.example.com",
          },
        ]}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Build release plan" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Release tag")).toHaveValue("v2026.05.16");
    expect(screen.getByLabelText("Public base URL")).toHaveValue(
      "https://profiles.example.com",
    );
  });

  it("submits trimmed values keyed by field name", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <PromptDialog
        open
        title="Upload LUTs"
        fields={[
          {
            name: "namespace",
            label: "Namespace for generated ids",
            defaultValue: "local",
          },
        ]}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );

    const field = screen.getByLabelText("Namespace for generated ids");
    await user.clear(field);
    await user.type(field, "  artist  ");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ namespace: "artist" });
  });

  it("does not submit and disables the button when a field is empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <PromptDialog
        open
        title="Load baseline"
        fields={[{ name: "url", label: "Catalog URL" }]}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );

    const submit = screen.getByRole("button", { name: "Submit" });
    expect(submit).toBeDisabled();

    await user.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();

    // Whitespace-only stays invalid.
    await user.type(screen.getByLabelText("Catalog URL"), "   ");
    expect(submit).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onCancel from the Cancel button", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <PromptDialog
        open
        title="Namespace"
        fields={[{ name: "namespace", label: "Namespace", defaultValue: "local" }]}
        onSubmit={() => {}}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <PromptDialog
        open
        title="Namespace"
        fields={[{ name: "namespace", label: "Namespace", defaultValue: "local" }]}
        onSubmit={() => {}}
        onCancel={onCancel}
      />,
    );

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("autofocuses the first field on open", () => {
    render(
      <PromptDialog
        open
        title="Build release plan"
        fields={[
          { name: "tag", label: "Release tag", defaultValue: "v1" },
          { name: "publicBaseUrl", label: "Public base URL", defaultValue: "u" },
        ]}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByLabelText("Release tag")).toHaveFocus();
  });

  it("renders nothing when closed", () => {
    render(
      <PromptDialog
        open={false}
        title="Hidden"
        fields={[{ name: "x", label: "X" }]}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("usePromptDialog", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function Harness({
    onResolved,
  }: {
    onResolved: (value: Record<string, string> | null) => void;
  }) {
    const { prompt, dialog } = usePromptDialog();
    const startedRef = useRef(false);
    useEffect(() => {
      if (startedRef.current) {
        return;
      }
      startedRef.current = true;
      void prompt({
        title: "Pending prompt",
        fields: [{ name: "x", label: "X" }],
      }).then(onResolved);
    }, [prompt, onResolved]);
    return <>{dialog}</>;
  }

  it("resolves a still-open prompt with null when the hook unmounts", async () => {
    const onResolved = vi.fn();
    const { unmount } = render(<Harness onResolved={onResolved} />);

    expect(
      await screen.findByRole("dialog", { name: "Pending prompt" }),
    ).toBeInTheDocument();
    expect(onResolved).not.toHaveBeenCalled();

    unmount();

    await vi.waitFor(() => {
      expect(onResolved).toHaveBeenCalledTimes(1);
    });
    expect(onResolved).toHaveBeenCalledWith(null);
  });

  it("cannot double-settle: cancel then a stray settle stays single", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();
    const { unmount } = render(<Harness onResolved={onResolved} />);

    await screen.findByRole("dialog", { name: "Pending prompt" });
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await vi.waitFor(() => {
      expect(onResolved).toHaveBeenCalledTimes(1);
    });
    expect(onResolved).toHaveBeenCalledWith(null);

    // Unmount triggers the cleanup settle; the pending request is already
    // cleared so it must NOT resolve the promise a second time.
    unmount();
    await Promise.resolve();
    expect(onResolved).toHaveBeenCalledTimes(1);
  });
});
