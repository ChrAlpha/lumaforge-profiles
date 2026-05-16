import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PromptDialog } from "../app/components/PromptDialog";

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
