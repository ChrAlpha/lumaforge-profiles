import type { CubeMetadata } from "../manifest/types";
import { slugify } from "../utils/slug";

function stripSlugParts(slug: string, parts: string[]) {
  const remove = new Set(parts);
  return slug
    .split("-")
    .filter((part) => !remove.has(part))
    .join("-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isArriContract(metadata: CubeMetadata) {
  return metadata.vendor === "arri" || metadata.inputTransfer?.startsWith("arri-");
}

function isFujifilmContract(metadata: CubeMetadata) {
  return metadata.vendor === "fujifilm" || metadata.inputTransfer?.startsWith("fujifilm-");
}

function inputGamutForTransfer(inputTransfer: string | undefined) {
  switch (inputTransfer) {
    case "arri-logc3":
      return "arri-wide-gamut-3";
    case "arri-logc4":
      return "arri-wide-gamut-4";
    case "fujifilm-f-log":
    case "fujifilm-f-log2":
      return "fujifilm-f-gamut";
    case "fujifilm-f-log2c":
      return "fujifilm-f-gamut-c";
  }
  return undefined;
}

function vendorForTransfer(inputTransfer: string | undefined) {
  if (inputTransfer?.startsWith("arri-")) {
    return "arri";
  }
  if (inputTransfer?.startsWith("fujifilm-")) {
    return "fujifilm";
  }
  return undefined;
}

function completeOutputContract(metadata: CubeMetadata) {
  if (metadata.outputTransfer === "srgb" && !metadata.outputGamut) {
    return { outputGamut: "rec709" };
  }
  if (metadata.outputGamut === "rec709" && !metadata.outputTransfer) {
    return { outputTransfer: "srgb" };
  }
  return {};
}

function arriContract(metadata: CubeMetadata): Partial<CubeMetadata> {
  const titleSlug = slugify(metadata.title ?? "");
  const variant = metadata.variant ?? stripSlugParts(titleSlug, [
    "arri",
    "alexa",
    "v3",
    "logc3",
    "logc4",
    "log",
    "rec",
    "bt",
    "709",
    "rec709",
    "cube",
    "lut"
  ]);
  const isLook = metadata.intent === "look" || metadata.family === "arri-look-library" || /^\d{4}(?:-|$)/.test(variant);

  return {
    vendor: "arri",
    inputGamut: metadata.inputGamut ?? inputGamutForTransfer(metadata.inputTransfer),
    intent: metadata.intent ?? (isLook ? "look" : "technical-output"),
    family: metadata.family ?? (isLook ? "arri-look-library" : "arri-technical-lut"),
    ...(variant ? { variant } : {})
  };
}

const FUJIFILM_FILM_SIMULATIONS = [
  { variant: "eterna-bleach-bypass", names: ["eterna-bleach-bypass", "eterna-bb"] },
  { variant: "classic-chrome", names: ["classic-chrome"] },
  { variant: "classic-neg", names: ["classic-neg", "classic-negative"] },
  { variant: "pro-neg-std", names: ["pro-neg-std"] },
  { variant: "reala-ace", names: ["reala-ace"] },
  { variant: "eterna", names: ["eterna"] },
  { variant: "provia", names: ["provia"] },
  { variant: "velvia", names: ["velvia"] },
  { variant: "astia", names: ["astia"] },
  { variant: "acros", names: ["acros"] },
  { variant: "wdr-709", names: ["wdr-709"] }
];

function fujifilmVariant(metadata: CubeMetadata) {
  const titleSlug = slugify(metadata.title ?? "");
  return metadata.variant ?? FUJIFILM_FILM_SIMULATIONS.find((item) => item.names.some((name) => titleSlug.includes(name)))?.variant;
}

function fujifilmContract(metadata: CubeMetadata): Partial<CubeMetadata> {
  const variant = fujifilmVariant(metadata);
  return {
    vendor: "fujifilm",
    inputGamut: metadata.inputGamut ?? inputGamutForTransfer(metadata.inputTransfer),
    intent: metadata.intent ?? (variant ? "look" : "technical-output"),
    family: metadata.family ?? (variant ? "fujifilm-film-simulation" : "fujifilm-technical-lut"),
    ...(variant ? { variant } : {})
  };
}

export function inferLutContract(metadata: CubeMetadata | undefined): Partial<CubeMetadata> | undefined {
  if (!metadata) {
    return undefined;
  }

  const hasContractMetadata = Boolean(
    metadata.inputTransfer || metadata.inputGamut || metadata.outputTransfer || metadata.outputGamut || metadata.vendor
  );
  if (!hasContractMetadata) {
    return undefined;
  }

  const base: Partial<CubeMetadata> = {
    vendor: metadata.vendor ?? vendorForTransfer(metadata.inputTransfer),
    inputTransfer: metadata.inputTransfer,
    inputGamut: metadata.inputGamut ?? inputGamutForTransfer(metadata.inputTransfer),
    outputTransfer: metadata.outputTransfer,
    outputGamut: metadata.outputGamut,
    intent: metadata.intent,
    family: metadata.family,
    variant: metadata.variant,
    contractSource: metadata.contractSource,
    contractSourceId: metadata.contractSourceId,
    contractConfidence: metadata.contractConfidence,
    ...completeOutputContract(metadata)
  };

  if (isArriContract({ ...metadata, ...base })) {
    return {
      ...base,
      ...arriContract({ ...metadata, ...base })
    };
  }

  if (isFujifilmContract({ ...metadata, ...base })) {
    return {
      ...base,
      ...fujifilmContract({ ...metadata, ...base })
    };
  }

  return base;
}

function contractSlugParts(contract: Partial<CubeMetadata>) {
  const transferSlug: Record<string, string> = {
    "arri-logc3": "logc3",
    "arri-logc4": "logc4",
    "fujifilm-f-log": "flog",
    "fujifilm-f-log2": "flog2",
    "fujifilm-f-log2c": "flog2c"
  };
  const parts: string[] = [];
  const input = contract.inputTransfer ? transferSlug[contract.inputTransfer] : undefined;
  if (input) {
    parts.push(input);
  }

  if (contract.outputTransfer === "srgb" && contract.outputGamut === "rec709") {
    parts.push("rec709");
  } else if (contract.outputTransfer && contract.outputTransfer === contract.inputTransfer) {
    parts.push("log");
  }

  return parts;
}

export function slugWithLutContract(baseSlug: string, contract: Partial<CubeMetadata> | undefined) {
  if (!contract) {
    return baseSlug;
  }

  const existing = new Set(baseSlug.split("-"));
  const missing = contractSlugParts(contract).filter((part) => {
    if (contract.vendor === "fujifilm" && contract.variant && part === "rec709") {
      return false;
    }
    const partSegments = part.split("-");
    return !partSegments.every((segment) => existing.has(segment)) && !baseSlug.includes(part);
  });

  if (missing.length === 0) {
    return baseSlug;
  }

  return `${baseSlug}-${missing.join("-")}`;
}
