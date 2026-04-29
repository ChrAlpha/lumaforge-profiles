import type { CubeMetadata } from "../manifest/types";

export interface SourcePackageRule {
  id: string;
  match: (relativePath: string) => boolean;
  lut: Partial<CubeMetadata>;
}

function normalizePath(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/[^a-z0-9/.]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^-+|-+$/g, "");
}

function withSource(ruleId: string, lut: Partial<CubeMetadata>): Partial<CubeMetadata> {
  return {
    ...lut,
    contractSource: "source-package-rule",
    contractSourceId: ruleId,
    contractConfidence: "high"
  };
}

const SOURCE_PACKAGE_RULES: SourcePackageRule[] = [
  {
    id: "arri-look-library-logc3-to-rec709",
    match: (relativePath) => relativePath.includes("/look-library-logc3-to-rec709/") || relativePath.includes("arri-look-library-logc3-to-rec709"),
    lut: withSource("arri-look-library-logc3-to-rec709", {
      vendor: "arri",
      inputTransfer: "arri-logc3",
      inputGamut: "arri-wide-gamut-3",
      outputTransfer: "srgb",
      outputGamut: "rec709",
      intent: "look",
      family: "arri-look-library"
    })
  },
  {
    id: "arri-look-library-logc4-log-to-log",
    match: (relativePath) => relativePath.includes("/look-library-logc4-log-to-log/") || relativePath.includes("arri-look-library-for-logc4"),
    lut: withSource("arri-look-library-logc4-log-to-log", {
      vendor: "arri",
      inputTransfer: "arri-logc4",
      inputGamut: "arri-wide-gamut-4",
      outputTransfer: "arri-logc4",
      outputGamut: "arri-wide-gamut-4",
      intent: "look",
      family: "arri-look-library"
    })
  },
  {
    id: "fujifilm-f-log-to-eterna",
    match: (relativePath) => relativePath.includes("/f-log-to-eterna/"),
    lut: withSource("fujifilm-f-log-to-eterna", {
      vendor: "fujifilm",
      inputTransfer: "fujifilm-f-log",
      inputGamut: "fujifilm-f-gamut",
      outputTransfer: "srgb",
      outputGamut: "rec709",
      intent: "look",
      family: "fujifilm-film-simulation",
      variant: "eterna"
    })
  },
  {
    id: "fujifilm-f-log2-to-eterna",
    match: (relativePath) => relativePath.includes("/f-log2-to-eterna/"),
    lut: withSource("fujifilm-f-log2-to-eterna", {
      vendor: "fujifilm",
      inputTransfer: "fujifilm-f-log2",
      inputGamut: "fujifilm-f-gamut",
      outputTransfer: "srgb",
      outputGamut: "rec709",
      intent: "look",
      family: "fujifilm-film-simulation",
      variant: "eterna"
    })
  },
  {
    id: "fujifilm-f-log2c-to-eterna",
    match: (relativePath) => relativePath.includes("/f-log2c-to-eterna/"),
    lut: withSource("fujifilm-f-log2c-to-eterna", {
      vendor: "fujifilm",
      inputTransfer: "fujifilm-f-log2c",
      inputGamut: "fujifilm-f-gamut-c",
      outputTransfer: "srgb",
      outputGamut: "rec709",
      intent: "look",
      family: "fujifilm-film-simulation",
      variant: "eterna"
    })
  }
];

export function inferSourcePackageLutContract(relativePath: string): Partial<CubeMetadata> | undefined {
  const normalized = `/${normalizePath(relativePath)}`;
  return SOURCE_PACKAGE_RULES.find((rule) => rule.match(normalized))?.lut;
}
