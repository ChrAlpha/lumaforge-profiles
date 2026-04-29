import { slugify } from "../utils/slug";
import type { CubeMetadata } from "../manifest/types";

export interface SourcePackageRule {
  id: string;
  match: (relativePath: string) => boolean;
  resolve: (relativePath: string) => Partial<CubeMetadata>;
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

function basename(normalizedPath: string) {
  return normalizedPath.split("/").pop() ?? normalizedPath;
}

function dirname(normalizedPath: string) {
  const parts = normalizedPath.split("/");
  parts.pop();
  return parts.join("/");
}

function withoutExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function withSource(ruleId: string, lut: Partial<CubeMetadata>): Partial<CubeMetadata> {
  return {
    ...lut,
    contractSource: "source-package-rule",
    contractSourceId: ruleId,
    contractConfidence: "high"
  };
}

function isDisplay709Transform(value: string) {
  return value.includes("rec709") || value.includes("709");
}

function parseFujifilmVariant(normalizedPath: string) {
  const file = withoutExtension(basename(normalizedPath));
  if (file.includes("to_eterna-bb") || file.includes("to-eterna-bb")) {
    return "eterna-bleach-bypass";
  }
  if (file.includes("to_classic-chrome")) {
    return "classic-chrome";
  }
  if (file.includes("to_classic-neg")) {
    return "classic-neg";
  }
  if (file.includes("to_pro-neg-std")) {
    return "pro-neg-std";
  }
  if (file.includes("to_reala-ace")) {
    return "reala-ace";
  }
  if (file.includes("to_wdr-709")) {
    return "wdr-709";
  }
  if (file.includes("to_eterna")) {
    return "eterna";
  }
  if (file.includes("to_provia")) {
    return "provia";
  }
  if (file.includes("to_velvia")) {
    return "velvia";
  }
  if (file.includes("to_astia")) {
    return "astia";
  }
  if (file.includes("to_acros")) {
    return "acros";
  }
  return undefined;
}

function parseSonyVariant(normalizedPath: string) {
  const file = slugify(withoutExtension(basename(normalizedPath)));
  if (file.includes("lc-709typea")) {
    return "lc-709typea";
  }
  if (file.includes("lc-709")) {
    return "lc-709";
  }
  if (file.includes("cine-709") || file.includes("cine709")) {
    return "cine-709";
  }
  if (file.includes("slog2-709")) {
    return "slog2-709";
  }
  return undefined;
}

function parseLeicaVariant(normalizedPath: string) {
  const dir = dirname(normalizedPath);
  if (dir.includes("/classic")) {
    return "classic";
  }
  if (dir.includes("/natural")) {
    return "natural";
  }
  return undefined;
}

function parseAutelVariant(normalizedPath: string) {
  const file = slugify(withoutExtension(basename(normalizedPath)));
  if (file.includes("evoiipro")) {
    return "evo-ii-pro";
  }
  if (file.includes("evoii")) {
    return "evo-ii";
  }
  return undefined;
}

const SOURCE_PACKAGE_RULES: SourcePackageRule[] = [
  {
    id: "arri-look-library-logc3-to-rec709",
    match: (relativePath) => relativePath.includes("/look-library-logc3-to-rec709/"),
    resolve: () =>
      withSource("arri-look-library-logc3-to-rec709", {
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
    match: (relativePath) => relativePath.includes("/look-library-logc4-log-to-log/"),
    resolve: () =>
      withSource("arri-look-library-logc4-log-to-log", {
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
    id: "fujifilm-gfx-eterna-55-f-log2c",
    match: (relativePath) =>
      relativePath.includes("/gfx-eterna-55-3d-lut-v110/")
      && relativePath.includes("/f-log2c/"),
    resolve: (relativePath) => {
      const variant = parseFujifilmVariant(relativePath);
      const file = withoutExtension(basename(relativePath));
      const isTechnicalOutput = file.includes("to_flog2c-709") || file.includes("to_wdr-709");
      return withSource("fujifilm-gfx-eterna-55-f-log2c", {
        vendor: "fujifilm",
        inputTransfer: "fujifilm-f-log2c",
        inputGamut: "fujifilm-f-gamut-c",
        outputTransfer: "srgb",
        outputGamut: "rec709",
        intent: isTechnicalOutput ? "technical-output" : "look",
        family: isTechnicalOutput ? "fujifilm-technical-lut" : "fujifilm-film-simulation",
        ...(variant ? { variant } : {})
      });
    }
  },
  {
    id: "fujifilm-f-log-to-eterna",
    match: (relativePath) => relativePath.includes("/f-log-to-eterna/"),
    resolve: () =>
      withSource("fujifilm-f-log-to-eterna", {
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
    resolve: () =>
      withSource("fujifilm-f-log2-to-eterna", {
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
    resolve: () =>
      withSource("fujifilm-f-log2c-to-eterna", {
        vendor: "fujifilm",
        inputTransfer: "fujifilm-f-log2c",
        inputGamut: "fujifilm-f-gamut-c",
        outputTransfer: "srgb",
        outputGamut: "rec709",
        intent: "look",
        family: "fujifilm-film-simulation",
        variant: "eterna"
      })
  },
  {
    id: "nikon-n-log-3d-lut",
    match: (relativePath) => relativePath.includes("/n-log-3d-lut/"),
    resolve: (relativePath) => {
      const file = slugify(withoutExtension(basename(relativePath)));
      const isCreative = file.startsWith("red-");
      const variant = file
        .replace(/^n-log-bt2020-to-/, "")
        .replace(/^red-/, "")
        .replace(/-rec2020-n-log-to-rec709-bt1886$/, "")
        .replace(/-size-33$/, "")
        .replace(/^-+|-+$/g, "");
      return withSource("nikon-n-log-3d-lut", {
        vendor: "nikon",
        inputTransfer: "nikon-n-log",
        inputGamut: "rec2020",
        outputTransfer: "bt1886",
        outputGamut: "rec709",
        intent: isCreative ? "combined-look-output" : "technical-output",
        family: "nikon-n-log",
        ...(variant ? { variant } : {})
      });
    }
  },
  {
    id: "red-ipp2-rec709",
    match: (relativePath) => relativePath.includes("/ipp2-cubes-sdr-core-v1.13/rec709/"),
    resolve: (relativePath) => {
      const file = slugify(withoutExtension(basename(relativePath)));
      const variant = file
        .replace(/^rwg-log3g10-to-rec709-bt1886-with-/, "")
        .replace(/-size-33-v-1-13$/, "")
        .replace(/^-+|-+$/g, "");
      return withSource("red-ipp2-rec709", {
        vendor: "red",
        inputTransfer: "red-log3g10",
        inputGamut: "red-wide-gamut-rgb",
        outputTransfer: "bt1886",
        outputGamut: "rec709",
        intent: "combined-look-output",
        family: "red-ipp2-sdr",
        ...(variant ? { variant } : {})
      });
    }
  },
  {
    id: "sony-s-gamut-s-log2",
    match: (relativePath) => relativePath.includes("/look-profile-s-gamut-s-log2/"),
    resolve: (relativePath) =>
      withSource("sony-s-gamut-s-log2", {
        vendor: "sony",
        inputTransfer: "sony-s-log2",
        inputGamut: "sony-s-gamut",
        outputTransfer: "srgb",
        outputGamut: "rec709",
        intent: "display-look",
        family: "sony-look-profile",
        ...(parseSonyVariant(relativePath) ? { variant: parseSonyVariant(relativePath) } : {})
      })
  },
  {
    id: "sony-s-gamut3-cine-s-log3",
    match: (relativePath) => relativePath.includes("/look-profile-s-gamut3-cine-s-log3/"),
    resolve: (relativePath) =>
      withSource("sony-s-gamut3-cine-s-log3", {
        vendor: "sony",
        inputTransfer: "sony-s-log3",
        inputGamut: "sony-s-gamut3-cine",
        outputTransfer: "srgb",
        outputGamut: "rec709",
        intent: "display-look",
        family: "sony-look-profile",
        ...(parseSonyVariant(relativePath) ? { variant: parseSonyVariant(relativePath) } : {})
      })
  },
  {
    id: "leica-sl2-s-l-log-luts",
    match: (relativePath) => relativePath.includes("/sl2-s-l-log-luts/"),
    resolve: (relativePath) => {
      const file = slugify(withoutExtension(basename(relativePath)));
      return withSource("leica-sl2-s-l-log-luts", {
        vendor: "leica",
        inputTransfer: "leica-l-log",
        inputGamut: "leica-l-gamut",
        outputTransfer: "gamma-2-4",
        outputGamut: file.includes("rec2020") ? "rec2020" : "rec709",
        intent: "look",
        family: "leica-l-log",
        ...(parseLeicaVariant(relativePath) ? { variant: parseLeicaVariant(relativePath) } : {})
      });
    }
  },
  {
    id: "filmic-pro-apple-log-luts-64x-2023",
    match: (relativePath) => relativePath.includes("/apple-log-luts-64x-2023/"),
    resolve: (relativePath) => {
      const file = slugify(withoutExtension(basename(relativePath)));
      return withSource("filmic-pro-apple-log-luts-64x-2023", {
        vendor: "filmic-pro",
        inputTransfer: "apple-log",
        inputGamut: "rec2020",
        outputTransfer: file.includes("applelogtolin") ? "linear" : "srgb",
        outputGamut: file.includes("applelogtolin") ? "rec2020" : "rec709",
        intent: "technical-output",
        family: "filmic-pro-apple-log",
        variant: file.includes("applelogtolin") ? "linear" : "rec709"
      });
    }
  },
  {
    id: "autel-evo-ii-alog-to-rec709",
    match: (relativePath) => relativePath.includes("/evo-ii-alog-to-rec709/"),
    resolve: (relativePath) =>
      withSource("autel-evo-ii-alog-to-rec709", {
        vendor: "autel-robotics",
        inputTransfer: "autel-a-log",
        inputGamut: "rec709",
        outputTransfer: "srgb",
        outputGamut: "rec709",
        intent: "technical-output",
        family: "autel-technical-lut",
        ...(parseAutelVariant(relativePath) ? { variant: parseAutelVariant(relativePath) } : {})
      })
  },
  {
    id: "autel-evo-ii-pro-alog-to-rec709",
    match: (relativePath) => relativePath.includes("/evo-ii-pro-alog-to-rec709/"),
    resolve: (relativePath) =>
      withSource("autel-evo-ii-pro-alog-to-rec709", {
        vendor: "autel-robotics",
        inputTransfer: "autel-a-log",
        inputGamut: "rec709",
        outputTransfer: "srgb",
        outputGamut: "rec709",
        intent: "technical-output",
        family: "autel-technical-lut",
        ...(parseAutelVariant(relativePath) ? { variant: parseAutelVariant(relativePath) } : {})
      })
  }
];

export function inferSourcePackageLutContract(relativePath: string): Partial<CubeMetadata> | undefined {
  const normalized = `/${normalizePath(relativePath)}`;
  const rule = SOURCE_PACKAGE_RULES.find((entry) => entry.match(normalized));
  return rule?.resolve(normalized);
}
