import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SecretField } from "../app/components/SecretField";

function ControlledSecretField({
  initialValue = "",
  onChangeSpy,
}: {
  initialValue?: string;
  onChangeSpy?: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <SecretField
      id="api-token"
      label="API token"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChangeSpy?.(next);
      }}
    />
  );
}

describe("SecretField", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders a label associated with a masked input by default", () => {
    render(
      <SecretField id="api-token" label="API token" value="" onChange={() => {}} />,
    );

    const input = screen.getByLabelText("API token");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "password");
  });

  it("toggles the input between masked and revealed via an accessible button", async () => {
    const user = userEvent.setup();
    render(
      <SecretField
        id="api-token"
        label="API token"
        value="s3cr3t"
        onChange={() => {}}
      />,
    );

    const input = screen.getByLabelText("API token");
    const toggle = screen.getByRole("button", { name: /show/i });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(input).toHaveAttribute("type", "password");

    await user.click(toggle);

    expect(input).toHaveAttribute("type", "text");
    const hideToggle = screen.getByRole("button", { name: /hide/i });
    expect(hideToggle).toHaveAttribute("aria-pressed", "true");

    await user.click(hideToggle);

    expect(input).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: /show/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("is controlled: renders the value prop and emits onChange when typing", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();

    render(<ControlledSecretField onChangeSpy={onChangeSpy} />);

    const input = screen.getByLabelText("API token");
    expect(input).toHaveValue("");

    await user.type(input, "abc");

    expect(onChangeSpy).toHaveBeenCalled();
    expect(onChangeSpy).toHaveBeenLastCalledWith("abc");
    expect(input).toHaveValue("abc");
  });

  it("renders the controlled value prop verbatim", () => {
    render(
      <SecretField
        id="api-token"
        label="API token"
        value="preset-value"
        onChange={() => {}}
      />,
    );

    expect(screen.getByLabelText("API token")).toHaveValue("preset-value");
  });

  it("uses a type=button toggle that does not submit a surrounding form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <SecretField
          id="api-token"
          label="API token"
          value=""
          onChange={() => {}}
        />
      </form>,
    );

    const toggle = screen.getByRole("button", { name: /show/i });
    expect(toggle).toHaveAttribute("type", "button");

    await user.click(toggle);

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
