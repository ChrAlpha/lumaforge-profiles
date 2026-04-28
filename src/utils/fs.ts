import path from "node:path";

import fs from "fs-extra";

export { fs };

export function toPosixPath(value: string) {
  return value.split(path.sep).join("/");
}

export function relativePosix(from: string, to: string) {
  return toPosixPath(path.relative(from, to));
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  return (await fs.readJson(filePath)) as T;
}

export async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  if (!(await fs.pathExists(filePath))) {
    return null;
  }
  return readJsonFile<T>(filePath);
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function fileByteSize(filePath: string) {
  return (await fs.stat(filePath)).size;
}

export function isSafeRelativePosixPath(value: string) {
  if (!value || value.startsWith("/") || value.includes("\\")) {
    return false;
  }
  const normalized = path.posix.normalize(value);
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
    return false;
  }
  return !normalized.split("/").includes("..");
}
