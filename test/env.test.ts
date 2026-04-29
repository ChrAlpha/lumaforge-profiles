import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadDotenvFiles } from "../src/env";

async function createTempEnvDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "lumaforge-profiles-env-"));
}

describe("dotenv loading", () => {
  test("loads variables from .env in the target cwd", async () => {
    const cwd = await createTempEnvDir();
    await fs.writeFile(
      path.join(cwd, ".env"),
      [
        "CLOUDFLARE_ACCOUNT_ID=from-dotenv",
        "CLOUDFLARE_R2_BUCKET=profiles-bucket",
      ].join("\n") + "\n",
    );

    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_R2_BUCKET;

    loadDotenvFiles({ cwd });

    expect(process.env.CLOUDFLARE_ACCOUNT_ID).toBe("from-dotenv");
    expect(process.env.CLOUDFLARE_R2_BUCKET).toBe("profiles-bucket");
  });

  test("does not override an existing environment variable", async () => {
    const cwd = await createTempEnvDir();
    await fs.writeFile(
      path.join(cwd, ".env"),
      "CLOUDFLARE_ACCOUNT_ID=from-dotenv\n",
    );

    process.env.CLOUDFLARE_ACCOUNT_ID = "already-set";

    loadDotenvFiles({ cwd });

    expect(process.env.CLOUDFLARE_ACCOUNT_ID).toBe("already-set");
  });

  test("missing .env files are ignored", async () => {
    const cwd = await createTempEnvDir();

    delete process.env.CLOUDFLARE_ACCOUNT_ID;

    expect(() => loadDotenvFiles({ cwd })).not.toThrow();
    expect(process.env.CLOUDFLARE_ACCOUNT_ID).toBeUndefined();
  });
});
