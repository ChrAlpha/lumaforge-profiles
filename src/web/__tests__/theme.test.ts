import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, test } from "vitest";

/**
 * Dark mode is implemented purely as a token swap in index.css: every
 * component consumes the warm `--color-*` tokens via Tailwind utilities and
 * adds NO per-component `dark:` variants.
 *
 * A source-string assertion is not enough here: in Tailwind v4 an `@theme`
 * block is ALWAYS processed as a theme definition and its variables are
 * hoisted/merged onto the global `:root`, regardless of any surrounding
 * `@media`. A nested `@theme` inside `@media (prefers-color-scheme: dark)`
 * therefore silently overrides the LIGHT palette for every user and breaks
 * dark mode. jsdom cannot observe this. The only reliable guard is to run
 * the real production CSS build and inspect the emitted stylesheet:
 *   - the top-level `:root` (outside any `@media`) must carry the LIGHT
 *     `--color-paper`, never the dark one;
 *   - the dark `--color-paper` must appear ONLY inside a
 *     `prefers-color-scheme: dark` media block.
 *
 * Tailwind v4 normalizes oklch literals (e.g. `oklch(0.97 0.016 86)` ->
 * `oklch(97% .016 86)`), so the expectations below match the normalized form.
 */
const webDir = path.resolve(import.meta.dirname, "..");
const projectRoot = path.resolve(webDir, "..", "..");

const LIGHT_PAPER = "oklch(97% .016 86)";
const DARK_PAPER = "oklch(21% .012 86)";

const tmpOutDir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-theme-build-"));

afterAll(() => {
  fs.rmSync(tmpOutDir, { recursive: true, force: true });
});

function buildCss(): string {
  // Build into a throwaway out dir so the real ./dist is never touched and
  // the working tree stays clean regardless of test outcome.
  execFileSync(
    "pnpm",
    ["exec", "vite", "build", "--outDir", tmpOutDir, "--emptyOutDir"],
    {
      cwd: projectRoot,
      stdio: "pipe",
    },
  );
  const cssFile = fs
    .readdirSync(path.join(tmpOutDir, "assets"))
    .find((name) => name.endsWith(".css"));
  if (!cssFile) {
    throw new Error("production build did not emit a CSS asset");
  }
  return fs.readFileSync(path.join(tmpOutDir, "assets", cssFile), "utf8");
}

describe("index.css theme contract (built CSS)", () => {
  const css = buildCss();

  test("the top-level :root uses the LIGHT paper, not the dark one", () => {
    // Strip every @media block so only the top-level cascade remains.
    let depth = 0;
    let topLevel = "";
    for (let i = 0; i < css.length; i += 1) {
      const atMedia = css.startsWith("@media", i);
      if (atMedia) {
        // Walk to the matching closing brace of this @media block.
        let j = css.indexOf("{", i);
        let braces = 0;
        for (; j < css.length; j += 1) {
          if (css[j] === "{") braces += 1;
          else if (css[j] === "}") {
            braces -= 1;
            if (braces === 0) break;
          }
        }
        i = j;
        continue;
      }
      if (depth === 0) topLevel += css[i];
    }
    void depth;

    expect(topLevel).toContain(`--color-paper:${LIGHT_PAPER}`);
    expect(topLevel).not.toContain(`--color-paper:${DARK_PAPER}`);
  });

  test("the dark paper appears only inside a prefers-color-scheme: dark block", () => {
    const darkIdx = css.indexOf("prefers-color-scheme:dark");
    expect(darkIdx).toBeGreaterThan(-1);

    // Every occurrence of the dark paper must sit after a dark media query
    // opener and before that block closes.
    let from = 0;
    let occurrences = 0;
    for (;;) {
      const at = css.indexOf(`--color-paper:${DARK_PAPER}`, from);
      if (at === -1) break;
      occurrences += 1;
      const enclosingMedia = css.lastIndexOf("@media", at);
      expect(enclosingMedia).toBeGreaterThan(-1);
      const mediaPrelude = css.slice(enclosingMedia, css.indexOf("{", enclosingMedia));
      expect(mediaPrelude).toContain("prefers-color-scheme:dark");
      from = at + 1;
    }
    expect(occurrences).toBeGreaterThan(0);
  });

  test("the legacy raw stylesheet is removed", () => {
    expect(fs.existsSync(path.resolve(webDir, "styles.css"))).toBe(false);
  });
});
