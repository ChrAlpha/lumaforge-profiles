import path from "node:path";

import { ID_KIND_SEGMENT_BY_KIND, KIND_SHORT_BY_KIND, type ProfileKind } from "../manifest/types";
import { slugify } from "../utils/slug";

export function versionMajor(version: string) {
  const first = Number(version.split(".")[0]);
  return Number.isInteger(first) && first > 0 ? first : 1;
}

export function entryDirectoryName(kind: ProfileKind, namespace: string, slug: string, version: string) {
  return `${KIND_SHORT_BY_KIND[kind]}.${slugify(namespace, "profiles")}.${slug}.v${versionMajor(version)}`;
}

export function entryId(kind: ProfileKind, namespace: string, slug: string) {
  return `org.${slugify(namespace, "profiles")}.${ID_KIND_SEGMENT_BY_KIND[kind]}.${slug}`;
}

export function appendHashToEntryDirectory(entryDirName: string, hashPrefix: string) {
  const suffix = entryDirName.match(/\.v\d+$/)?.[0] ?? "";
  if (!suffix) {
    return `${entryDirName}-${hashPrefix}`;
  }
  return `${entryDirName.slice(0, -suffix.length)}-${hashPrefix}${suffix}`;
}

export function appendHashToFileName(fileName: string, hashPrefix: string) {
  const ext = path.extname(fileName);
  const stem = path.basename(fileName, ext);
  return `${stem}-${hashPrefix}${ext}`;
}
