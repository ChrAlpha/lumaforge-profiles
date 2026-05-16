import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

/**
 * Dark mode is implemented purely as a token swap in index.css: every
 * component consumes the warm `--color-*` tokens via Tailwind utilities and
 * adds NO per-component `dark:` variants. jsdom does not apply
 * `@media (prefers-color-scheme)` to computed styles reliably, so the dark
 * contract is locked structurally against the single styling source of truth.
 */
const indexCss = fs.readFileSync(
  path.resolve(import.meta.dirname, "..", "index.css"),
  "utf8",
);

const CORE_TOKENS = [
  "--color-paper",
  "--color-surface",
  "--color-ink",
  "--color-ink-soft",
  "--color-line",
  "--color-accent",
  "--color-positive",
] as const;

describe("index.css theme contract", () => {
  test("defines every core token in the default (light) @theme", () => {
    const lightBlock = indexCss.slice(
      indexCss.indexOf("@theme"),
      indexCss.indexOf("@media"),
    );
    for (const token of CORE_TOKENS) {
      expect(lightBlock).toContain(`${token}:`);
    }
  });

  test("overrides every core token in a prefers-color-scheme: dark block", () => {
    const darkIndex = indexCss.indexOf("@media (prefers-color-scheme: dark)");
    expect(darkIndex).toBeGreaterThan(-1);
    const darkBlock = indexCss.slice(darkIndex);
    for (const token of CORE_TOKENS) {
      expect(darkBlock).toContain(`${token}:`);
    }
  });

  test("the legacy raw stylesheet is removed", () => {
    expect(
      fs.existsSync(path.resolve(import.meta.dirname, "..", "styles.css")),
    ).toBe(false);
  });
});
