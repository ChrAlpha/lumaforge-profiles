import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  StatusToastProvider,
  useStatusToast,
} from "../app/components/StatusToast";

function NotifyButton({
  message,
  variant,
}: {
  message: string;
  variant?: "success" | "error";
}) {
  const { notify } = useStatusToast();
  return (
    <button type="button" onClick={() => notify(message, variant)}>
      fire {message}
    </button>
  );
}

describe("StatusToast", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders children inside the provider without any toast initially", () => {
    render(
      <StatusToastProvider>
        <NotifyButton message="hello" />
      </StatusToastProvider>,
    );

    expect(
      screen.getByRole("button", { name: "fire hello" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("hello")).not.toBeInTheDocument();
  });

  it("notify shows a toast containing the message text", async () => {
    const user = userEvent.setup();

    render(
      <StatusToastProvider>
        <NotifyButton message="Imported 1 LUT file(s)." />
      </StatusToastProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: /fire Imported 1 LUT/ }),
    );

    expect(
      await screen.findByText("Imported 1 LUT file(s)."),
    ).toBeInTheDocument();
  });

  it("dismisses a toast via its accessible close button", async () => {
    const user = userEvent.setup();

    render(
      <StatusToastProvider>
        <NotifyButton message="dismiss me" />
      </StatusToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "fire dismiss me" }));
    await screen.findByText("dismiss me");

    await user.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(() => {
      expect(screen.queryByText("dismiss me")).not.toBeInTheDocument();
    });
  });

  it("stacks two toasts when notify is called twice", async () => {
    const user = userEvent.setup();

    render(
      <StatusToastProvider>
        <NotifyButton message="first" />
        <NotifyButton message="second" />
      </StatusToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "fire first" }));
    await user.click(screen.getByRole("button", { name: "fire second" }));

    expect(await screen.findByText("first")).toBeInTheDocument();
    expect(await screen.findByText("second")).toBeInTheDocument();
  });

  it("marks success and error toasts with a stable data-variant", async () => {
    const user = userEvent.setup();

    render(
      <StatusToastProvider>
        <NotifyButton message="ok msg" variant="success" />
        <NotifyButton message="bad msg" variant="error" />
      </StatusToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "fire ok msg" }));
    await user.click(screen.getByRole("button", { name: "fire bad msg" }));

    const ok = (await screen.findByText("ok msg")).closest("[data-variant]");
    const bad = (await screen.findByText("bad msg")).closest("[data-variant]");

    expect(ok).toHaveAttribute("data-variant", "success");
    expect(bad).toHaveAttribute("data-variant", "error");
  });

  it("defaults to the success variant when none is given", async () => {
    const user = userEvent.setup();

    render(
      <StatusToastProvider>
        <NotifyButton message="default variant" />
      </StatusToastProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: "fire default variant" }),
    );

    const toast = (await screen.findByText("default variant")).closest(
      "[data-variant]",
    );
    expect(toast).toHaveAttribute("data-variant", "success");
  });
});
