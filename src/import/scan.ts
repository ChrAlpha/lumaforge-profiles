import path from "node:path";

import fg from "fast-glob";

import { classifyProfileFile, type ProfileClassification } from "./classify";
import { toPosixPath } from "../utils/fs";

export interface ScannedProfileAsset {
  absolutePath: string;
  relativePath: string;
  classification: ProfileClassification;
}

export async function scanImportDirectory(fromDir: string): Promise<ScannedProfileAsset[]> {
  const entries = await fg(["**/*"], {
    cwd: fromDir,
    absolute: false,
    onlyFiles: true,
    dot: false,
    unique: true
  });

  return entries
    .map((entry) => {
      const relativePath = toPosixPath(entry);
      const absolutePath = path.join(fromDir, entry);
      const classification = classifyProfileFile(entry);
      return classification ? { absolutePath, relativePath, classification } : null;
    })
    .filter((entry): entry is ScannedProfileAsset => Boolean(entry))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}
