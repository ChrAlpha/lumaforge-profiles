import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const rootDir = path.resolve(import.meta.dirname, "..");

describe("test layout", () => {
  test("keeps web feature tests next to their source modules", () => {
    expect(fs.existsSync(path.join(rootDir, "test", "web-workspace.test.ts"))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, "test", "web-release.test.ts"))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, "test", "web-publish.test.ts"))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, "test", "web-ui.test.ts"))).toBe(false);

    expect(fs.existsSync(path.join(rootDir, "src", "web", "__tests__", "workspace.test.ts"))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, "src", "web", "__tests__", "release.test.ts"))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, "src", "web", "__tests__", "publish.test.ts"))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, "src", "web", "__tests__", "ui.test.tsx"))).toBe(true);
  });
});
