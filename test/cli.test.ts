import { execa } from "execa";

describe("profiles CLI", () => {
  test("exposes only S3 object-storage commands", async () => {
    const result = await execa("pnpm", ["exec", "tsx", "src/cli.ts", "--help"]);

    expect(result.stdout).toContain("build-s3");
    expect(result.stdout).toContain("publish-s3");
    expect(result.stdout).toContain("s3-gc");
    expect(result.stdout).not.toContain("build-r2");
    expect(result.stdout).not.toContain("publish-r2");
    expect(result.stdout).not.toContain("r2-gc");
  });
});
