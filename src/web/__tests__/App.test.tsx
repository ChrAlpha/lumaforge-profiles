import { describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { App } from "../app/App";

describe("App", () => {
  it("renders the studio root with a stable test hook", () => {
    const { container } = render(<App />);

    const root = container.querySelector("[data-app-root]");
    expect(root).not.toBeNull();
    expect(screen.getByText(/LumaForge Profiles Studio/i)).toBeInTheDocument();

    cleanup();
  });
});
