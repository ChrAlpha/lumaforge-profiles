import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadDotenvFiles } from "../src/env";
import { loadS3ConfigFromEnv } from "../src/release/s3-store";

async function createTempEnvDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "lumaforge-profiles-env-"));
}

describe("dotenv loading", () => {
  test("loads variables from .env in the target cwd", async () => {
    const cwd = await createTempEnvDir();
    await fs.writeFile(
      path.join(cwd, ".env"),
      [
        "S3_ENDPOINT=https://s3.example.com",
        "S3_BUCKET=profiles-bucket",
      ].join("\n") + "\n",
    );

    delete process.env.S3_ENDPOINT;
    delete process.env.S3_BUCKET;

    loadDotenvFiles({ cwd });

    expect(process.env.S3_ENDPOINT).toBe("https://s3.example.com");
    expect(process.env.S3_BUCKET).toBe("profiles-bucket");
  });

  test("does not override an existing environment variable", async () => {
    const cwd = await createTempEnvDir();
    await fs.writeFile(path.join(cwd, ".env"), "S3_BUCKET=from-dotenv\n");

    process.env.S3_BUCKET = "already-set";

    loadDotenvFiles({ cwd });

    expect(process.env.S3_BUCKET).toBe("already-set");
  });

  test("missing .env files are ignored", async () => {
    const cwd = await createTempEnvDir();

    delete process.env.S3_BUCKET;

    expect(() => loadDotenvFiles({ cwd })).not.toThrow();
    expect(process.env.S3_BUCKET).toBeUndefined();
  });
});

describe("S3 environment config", () => {
  const names = [
    "S3_BUCKET",
    "S3_ENDPOINT",
    "S3_REGION",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "S3_SESSION_TOKEN",
    "S3_PUBLIC_BASE_URL",
    "S3_FORCE_PATH_STYLE",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_R2_BUCKET",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  ];

  beforeEach(() => {
    for (const name of names) {
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of names) {
      delete process.env[name];
    }
  });

  test("loads generic S3-compatible storage variables", () => {
    process.env.S3_BUCKET = "profiles";
    process.env.S3_ENDPOINT = "https://s3.us-west-2.amazonaws.com";
    process.env.S3_REGION = "us-west-2";
    process.env.S3_ACCESS_KEY_ID = "access";
    process.env.S3_SECRET_ACCESS_KEY = "secret";
    process.env.S3_SESSION_TOKEN = "session";
    process.env.S3_PUBLIC_BASE_URL = "https://profiles.example.com";
    process.env.S3_FORCE_PATH_STYLE = "true";

    expect(loadS3ConfigFromEnv()).toEqual({
      bucket: "profiles",
      endpoint: "https://s3.us-west-2.amazonaws.com",
      region: "us-west-2",
      accessKeyId: "access",
      secretAccessKey: "secret",
      sessionToken: "session",
      publicBaseUrl: "https://profiles.example.com",
      forcePathStyle: true,
    });
  });

  test("requires S3 variables instead of legacy provider-specific names", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "account";
    process.env.CLOUDFLARE_R2_BUCKET = "profiles-r2";
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = "r2-access";
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = "r2-secret";

    expect(() => loadS3ConfigFromEnv()).toThrow(
      /Missing required environment variable S3_BUCKET\./,
    );
  });
});
