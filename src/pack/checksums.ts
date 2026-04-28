import path from "node:path";

import { sha256File } from "../utils/hash";

export interface ChecksumEntry {
  fileName: string;
  sha256: string;
}

export async function checksumFile(filePath: string): Promise<ChecksumEntry> {
  return {
    fileName: path.basename(filePath),
    sha256: await sha256File(filePath)
  };
}

export function formatSha256Sums(entries: ChecksumEntry[]) {
  return `${entries
    .slice()
    .sort((a, b) => a.fileName.localeCompare(b.fileName))
    .map((entry) => `${entry.sha256}  ${entry.fileName}`)
    .join("\n")}\n`;
}
