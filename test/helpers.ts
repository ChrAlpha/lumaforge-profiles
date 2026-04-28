import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function createTempRepo(prefix = "lumaforge-profiles-test-") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await fs.mkdir(path.join(root, "profiles"), { recursive: true });
  return root;
}

export async function writeFixture(root: string, relativePath: string, content: string) {
  const fullPath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content);
  return fullPath;
}

export async function readJson<T>(root: string, relativePath: string): Promise<T> {
  const raw = await fs.readFile(path.join(root, relativePath), "utf8");
  return JSON.parse(raw) as T;
}

export function posixPath(value: string) {
  return value.split(path.sep).join("/");
}
