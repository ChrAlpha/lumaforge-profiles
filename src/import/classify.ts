import path from "node:path";

import { fs } from "../utils/fs";
import { titleFromStem } from "../utils/slug";
import type { CubeMetadata, ProfileKind } from "../manifest/types";

export interface ProfileClassification {
  kind: ProfileKind;
  format: "cube" | "dcp" | "lcp";
  role: string;
  mediaType: string;
}

const classifications: Record<string, ProfileClassification> = {
  ".cube": {
    kind: "lut",
    format: "cube",
    role: "cube-lut",
    mediaType: "application/x-cube-lut"
  },
  ".dcp": {
    kind: "camera-profile",
    format: "dcp",
    role: "dcp",
    mediaType: "application/x-adobe-dng-camera-profile"
  },
  ".lcp": {
    kind: "lens-correction-profile",
    format: "lcp",
    role: "lcp",
    mediaType: "application/x-adobe-lens-correction-profile"
  }
};

export function classifyProfileFile(filePath: string): ProfileClassification | null {
  return classifications[path.extname(filePath).toLowerCase()] ?? null;
}

export function defaultTitleForProfile(filePath: string) {
  return titleFromStem(path.basename(filePath, path.extname(filePath)));
}

function parseTriple(value: string): [number, number, number] | undefined {
  const numbers = value
    .trim()
    .split(/\s+/)
    .map((part) => Number(part));
  if (numbers.length !== 3 || numbers.some((number) => !Number.isFinite(number))) {
    return undefined;
  }
  return [numbers[0]!, numbers[1]!, numbers[2]!];
}

export async function parseCubeMetadata(filePath: string): Promise<CubeMetadata | undefined> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    const metadata: CubeMetadata = {};

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      if (line.startsWith("#")) {
        continue;
      }

      const title = /^TITLE\s+"?([^"]+)"?/i.exec(line);
      if (title) {
        metadata.title = title[1]!.trim();
        continue;
      }

      const lut1d = /^LUT_1D_SIZE\s+(\d+)/i.exec(line);
      if (lut1d) {
        metadata.dimension = "1d";
        metadata.size = Number(lut1d[1]);
        continue;
      }

      const lut3d = /^LUT_3D_SIZE\s+(\d+)/i.exec(line);
      if (lut3d) {
        metadata.dimension = "3d";
        metadata.size = Number(lut3d[1]);
        continue;
      }

      const domainMin = /^DOMAIN_MIN\s+(.+)$/i.exec(line);
      if (domainMin) {
        metadata.domainMin = parseTriple(domainMin[1]!);
        continue;
      }

      const domainMax = /^DOMAIN_MAX\s+(.+)$/i.exec(line);
      if (domainMax) {
        metadata.domainMax = parseTriple(domainMax[1]!);
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  } catch {
    return undefined;
  }
}

function uniqueNonEmpty(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function matchXmlText(text: string, names: string[]) {
  const matches: string[] = [];
  for (const name of names) {
    const expression = new RegExp(`<[^>]*(?:${name})[^>]*>([^<]+)<\\/[^>]+>`, "gi");
    for (const match of text.matchAll(expression)) {
      matches.push(match[1]!.trim());
    }
  }
  return matches;
}

export async function inferTargets(filePath: string, classification: ProfileClassification): Promise<Record<string, unknown>> {
  if (classification.kind === "camera-profile") {
    return {
      cameraMakers: [],
      cameraModels: []
    };
  }

  if (classification.kind !== "lens-correction-profile") {
    return {};
  }

  try {
    const text = await fs.readFile(filePath, "utf8");
    const lensModels = uniqueNonEmpty(matchXmlText(text, ["lensmodel", "lens", "model"]));
    const lensMakers = uniqueNonEmpty(matchXmlText(text, ["lensmaker", "maker"]));
    const cameraMakers = uniqueNonEmpty(matchXmlText(text, ["cameramaker"]));
    const cameraModels = uniqueNonEmpty(matchXmlText(text, ["cameramodel"]));

    return {
      lensMakers,
      lensModels,
      cameraMakers,
      cameraModels
    };
  } catch {
    return {
      lensMakers: [],
      lensModels: [],
      cameraMakers: [],
      cameraModels: []
    };
  }
}
