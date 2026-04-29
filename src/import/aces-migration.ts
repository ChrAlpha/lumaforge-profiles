import type { CubeMetadata } from "../manifest/types";
import { fs } from "../utils/fs";

type Rgb = [number, number, number];
type Mat3 = [number, number, number, number, number, number, number, number, number];

const TARGET_INPUT_TRANSFER = "acescct";
const TARGET_INPUT_GAMUT = "aces-ap1";
const TARGET_OUTPUT_TRANSFER = "srgb";
const TARGET_OUTPUT_GAMUT = "rec709";
const TARGET_OUTPUT_GAMUT_MATRIX_ID = "srgb-rec709";
export const DEFAULT_ACES_LUT_SIZE = 65;

interface ParsedCube3d {
  title?: string;
  size: number;
  domainMin: Rgb;
  domainMax: Rgb;
  data: Float32Array;
}

export interface AcescctAp1MigrationOptions {
  sourcePath: string;
  title: string;
  sourceContract: Partial<CubeMetadata>;
  gridSize?: number;
}

export interface AcescctAp1MigrationResult {
  cubeText: string;
  metadata: CubeMetadata;
}

export interface LutMigrationSupport {
  supported: boolean;
  reason?: string;
}

function parseTriple(value: string): Rgb | undefined {
  const parts = value.trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return undefined;
  }
  return [parts[0]!, parts[1]!, parts[2]!];
}

function parseDataTriple(line: string): Rgb | undefined {
  if (!/^[-+.\d]/.test(line)) {
    return undefined;
  }
  const parts = line.split(/\s+/).slice(0, 3).map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return undefined;
  }
  return [parts[0]!, parts[1]!, parts[2]!];
}

async function parseCube3d(filePath: string): Promise<ParsedCube3d> {
  const text = await fs.readFile(filePath, "utf8");
  const data: number[] = [];
  let title: string | undefined;
  let size: number | undefined;
  let domainMin: Rgb = [0, 0, 0];
  let domainMax: Rgb = [1, 1, 1];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const titleMatch = /^TITLE\s+"?([^"]+)"?/i.exec(line);
    if (titleMatch) {
      title = titleMatch[1]!.trim();
      continue;
    }

    const sizeMatch = /^LUT_3D_SIZE\s+(\d+)/i.exec(line);
    if (sizeMatch) {
      size = Number(sizeMatch[1]);
      continue;
    }

    const domainMinMatch = /^DOMAIN_MIN\s+(.+)$/i.exec(line);
    if (domainMinMatch) {
      domainMin = parseTriple(domainMinMatch[1]!) ?? domainMin;
      continue;
    }

    const domainMaxMatch = /^DOMAIN_MAX\s+(.+)$/i.exec(line);
    if (domainMaxMatch) {
      domainMax = parseTriple(domainMaxMatch[1]!) ?? domainMax;
      continue;
    }

    const triple = parseDataTriple(line);
    if (triple) {
      data.push(...triple);
    }
  }

  if (!size || size < 2) {
    throw new Error("Cube LUT must declare LUT_3D_SIZE >= 2.");
  }

  const expectedValueCount = size ** 3 * 3;
  if (data.length !== expectedValueCount) {
    throw new Error(
      `Cube LUT data length mismatch: expected ${expectedValueCount} values, found ${data.length}.`,
    );
  }

  return {
    title,
    size,
    domainMin,
    domainMax,
    data: new Float32Array(data),
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function readCubeValue(cube: ParsedCube3d, r: number, g: number, b: number, channel: number) {
  return cube.data[((b * cube.size + g) * cube.size + r) * 3 + channel] ?? 0;
}

function sampleCube(cube: ParsedCube3d, input: Rgb): Rgb {
  const normalized = input.map((value, channel) => {
    const min = cube.domainMin[channel]!;
    const max = cube.domainMax[channel]!;
    const width = max - min;
    return width === 0 ? 0 : (value - min) / width;
  }) as Rgb;
  const maxIndex = cube.size - 1;
  const x = clamp01(normalized[0]) * maxIndex;
  const y = clamp01(normalized[1]) * maxIndex;
  const z = clamp01(normalized[2]) * maxIndex;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const x1 = Math.min(maxIndex, x0 + 1);
  const y1 = Math.min(maxIndex, y0 + 1);
  const z1 = Math.min(maxIndex, z0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const tz = z - z0;
  const output: Rgb = [0, 0, 0];

  for (let channel = 0; channel < 3; channel += 1) {
    const c00 = mix(readCubeValue(cube, x0, y0, z0, channel), readCubeValue(cube, x1, y0, z0, channel), tx);
    const c10 = mix(readCubeValue(cube, x0, y1, z0, channel), readCubeValue(cube, x1, y1, z0, channel), tx);
    const c01 = mix(readCubeValue(cube, x0, y0, z1, channel), readCubeValue(cube, x1, y0, z1, channel), tx);
    const c11 = mix(readCubeValue(cube, x0, y1, z1, channel), readCubeValue(cube, x1, y1, z1, channel), tx);
    output[channel] = mix(mix(c00, c10, ty), mix(c01, c11, ty), tz);
  }

  return output;
}

const D65: [number, number] = [0.3127, 0.329];
const D60: [number, number] = [0.32168, 0.33767];

interface ColorSpace {
  primaries: {
    red: [number, number];
    green: [number, number];
    blue: [number, number];
  };
  whitePoint: [number, number];
}

const COLOR_SPACES: Record<string, ColorSpace> = {
  "aces-ap1": {
    primaries: {
      red: [0.713, 0.293],
      green: [0.165, 0.83],
      blue: [0.128, 0.044],
    },
    whitePoint: D60,
  },
  "srgb-rec709": {
    primaries: {
      red: [0.64, 0.33],
      green: [0.3, 0.6],
      blue: [0.15, 0.06],
    },
    whitePoint: D65,
  },
  rec2020: {
    primaries: {
      red: [0.708, 0.292],
      green: [0.17, 0.797],
      blue: [0.131, 0.046],
    },
    whitePoint: D65,
  },
  "s-gamut": {
    primaries: {
      red: [0.73, 0.28],
      green: [0.14, 0.855],
      blue: [0.1, -0.05],
    },
    whitePoint: D65,
  },
  "s-gamut3-cine": {
    primaries: {
      red: [0.766, 0.275],
      green: [0.225, 0.8],
      blue: [0.089, -0.087],
    },
    whitePoint: D65,
  },
  "f-gamut": {
    primaries: {
      red: [0.708, 0.292],
      green: [0.17, 0.797],
      blue: [0.131, 0.046],
    },
    whitePoint: D65,
  },
  "f-gamut-c": {
    primaries: {
      red: [0.7347, 0.2653],
      green: [0.0263, 0.9737],
      blue: [0.1173, -0.0224],
    },
    whitePoint: D65,
  },
  "arri-wide-gamut-3": {
    primaries: {
      red: [0.684, 0.313],
      green: [0.221, 0.848],
      blue: [0.0861, -0.102],
    },
    whitePoint: D65,
  },
  "arri-wide-gamut-4": {
    primaries: {
      red: [0.7347, 0.2653],
      green: [0.1424, 0.8576],
      blue: [0.0991, -0.0308],
    },
    whitePoint: D65,
  },
  "red-wide-gamut-rgb": {
    primaries: {
      red: [0.780308, 0.304253],
      green: [0.121595, 1.493994],
      blue: [0.095612, -0.084589],
    },
    whitePoint: D65,
  },
};

const GAMUT_ALIASES: Record<string, string> = {
  "aces-ap1": "aces-ap1",
  acescg: "aces-ap1",
  ap1: "aces-ap1",
  rec709: "srgb-rec709",
  "bt-709": "srgb-rec709",
  bt709: "srgb-rec709",
  srgb: "srgb-rec709",
  "srgb-rec709": "srgb-rec709",
  rec2020: "rec2020",
  "bt-2020": "rec2020",
  bt2020: "rec2020",
  "sony-s-gamut": "s-gamut",
  "s-gamut": "s-gamut",
  "sony-s-gamut3-cine": "s-gamut3-cine",
  "s-gamut3-cine": "s-gamut3-cine",
  "fujifilm-f-gamut": "f-gamut",
  "f-gamut": "f-gamut",
  "fujifilm-f-gamut-c": "f-gamut-c",
  "f-gamut-c": "f-gamut-c",
  "arri-wide-gamut-3": "arri-wide-gamut-3",
  awg3: "arri-wide-gamut-3",
  "arri-wide-gamut-4": "arri-wide-gamut-4",
  awg4: "arri-wide-gamut-4",
  "red-wide-gamut-rgb": "red-wide-gamut-rgb",
  rwg: "red-wide-gamut-rgb",
};

function normalizeId(value: string) {
  return value.toLowerCase().replace(/[\s_/.]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

function resolveGamutId(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  return GAMUT_ALIASES[normalizeId(value)];
}

function mat3Identity(): Mat3 {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

function mat3Multiply(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

function mat3Invert(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) {
    throw new Error("Matrix is singular.");
  }
  const invDet = 1 / det;
  return [
    (e * i - f * h) * invDet,
    (c * h - b * i) * invDet,
    (b * f - c * e) * invDet,
    (f * g - d * i) * invDet,
    (a * i - c * g) * invDet,
    (c * d - a * f) * invDet,
    (d * h - e * g) * invDet,
    (b * g - a * h) * invDet,
    (a * e - b * d) * invDet,
  ];
}

function xyToXyz(x: number, y: number): Rgb {
  if (y === 0) {
    return [0, 0, 0];
  }
  return [x / y, 1, (1 - x - y) / y];
}

function computeRgbToXyzMatrix(colorSpace: ColorSpace): Mat3 {
  const { primaries, whitePoint } = colorSpace;
  const Xr = primaries.red[0] / primaries.red[1];
  const Yr = 1;
  const Zr = (1 - primaries.red[0] - primaries.red[1]) / primaries.red[1];
  const Xg = primaries.green[0] / primaries.green[1];
  const Yg = 1;
  const Zg = (1 - primaries.green[0] - primaries.green[1]) / primaries.green[1];
  const Xb = primaries.blue[0] / primaries.blue[1];
  const Yb = 1;
  const Zb = (1 - primaries.blue[0] - primaries.blue[1]) / primaries.blue[1];
  const [Xw, Yw, Zw] = xyToXyz(whitePoint[0], whitePoint[1]);
  const invPrimaries = mat3Invert([Xr, Xg, Xb, Yr, Yg, Yb, Zr, Zg, Zb]);
  const Sr = invPrimaries[0] * Xw + invPrimaries[1] * Yw + invPrimaries[2] * Zw;
  const Sg = invPrimaries[3] * Xw + invPrimaries[4] * Yw + invPrimaries[5] * Zw;
  const Sb = invPrimaries[6] * Xw + invPrimaries[7] * Yw + invPrimaries[8] * Zw;
  return [Sr * Xr, Sg * Xg, Sb * Xb, Sr * Yr, Sg * Yg, Sb * Yb, Sr * Zr, Sg * Zg, Sb * Zb];
}

const BRADFORD_MA: Mat3 = [0.8951, 0.2664, -0.1614, -0.7502, 1.7135, 0.0367, 0.0389, -0.0685, 1.0296];
const BRADFORD_MA_INV = mat3Invert(BRADFORD_MA);

function chromaticAdaptationMatrix(srcWhite: [number, number], dstWhite: [number, number]): Mat3 {
  const [srcX, srcY, srcZ] = xyToXyz(srcWhite[0], srcWhite[1]);
  const [dstX, dstY, dstZ] = xyToXyz(dstWhite[0], dstWhite[1]);
  const srcCone = [
    BRADFORD_MA[0] * srcX + BRADFORD_MA[1] * srcY + BRADFORD_MA[2] * srcZ,
    BRADFORD_MA[3] * srcX + BRADFORD_MA[4] * srcY + BRADFORD_MA[5] * srcZ,
    BRADFORD_MA[6] * srcX + BRADFORD_MA[7] * srcY + BRADFORD_MA[8] * srcZ,
  ];
  const dstCone = [
    BRADFORD_MA[0] * dstX + BRADFORD_MA[1] * dstY + BRADFORD_MA[2] * dstZ,
    BRADFORD_MA[3] * dstX + BRADFORD_MA[4] * dstY + BRADFORD_MA[5] * dstZ,
    BRADFORD_MA[6] * dstX + BRADFORD_MA[7] * dstY + BRADFORD_MA[8] * dstZ,
  ];
  const scale: Mat3 = [dstCone[0] / srcCone[0], 0, 0, 0, dstCone[1] / srcCone[1], 0, 0, 0, dstCone[2] / srcCone[2]];
  return mat3Multiply(BRADFORD_MA_INV, mat3Multiply(scale, BRADFORD_MA));
}

function getGamutMatrix(srcGamut: string, dstGamut: string): Mat3 {
  const srcId = resolveGamutId(srcGamut);
  const dstId = resolveGamutId(dstGamut);
  if (!srcId || !dstId) {
    throw new Error(`Unsupported gamut conversion: ${srcGamut} -> ${dstGamut}.`);
  }
  if (srcId === dstId) {
    return mat3Identity();
  }
  const src = COLOR_SPACES[srcId]!;
  const dst = COLOR_SPACES[dstId]!;
  const srcToXyz = computeRgbToXyzMatrix(src);
  const xyzToDst = mat3Invert(computeRgbToXyzMatrix(dst));
  if (
    Math.abs(src.whitePoint[0] - dst.whitePoint[0]) > 0.001 ||
    Math.abs(src.whitePoint[1] - dst.whitePoint[1]) > 0.001
  ) {
    return mat3Multiply(xyzToDst, mat3Multiply(chromaticAdaptationMatrix(src.whitePoint, dst.whitePoint), srcToXyz));
  }
  return mat3Multiply(xyzToDst, srcToXyz);
}

function applyMatrix(matrix: Mat3, value: Rgb): Rgb {
  return [
    matrix[0] * value[0] + matrix[1] * value[1] + matrix[2] * value[2],
    matrix[3] * value[0] + matrix[4] * value[1] + matrix[5] * value[2],
    matrix[6] * value[0] + matrix[7] * value[1] + matrix[8] * value[2],
  ];
}

const ACES_LOG_A = 17.52;
const ACES_LOG_B = 9.72;
const ACESCCT_CUT = 0.0078125;
const ACESCCT_SLOPE = 10.5402377416545;
const ACESCCT_OFFSET = 0.0729055341958355;
const ACESCCT_CUT_ENCODED = 0.155251141552511;

function acescctEncode(linear: number) {
  if (linear <= ACESCCT_CUT) {
    return ACESCCT_SLOPE * linear + ACESCCT_OFFSET;
  }
  return (Math.log2(linear) + ACES_LOG_B) / ACES_LOG_A;
}

function acescctDecode(encoded: number) {
  if (encoded <= ACESCCT_CUT_ENCODED) {
    return (encoded - ACESCCT_OFFSET) / ACESCCT_SLOPE;
  }
  return 2 ** (encoded * ACES_LOG_A - ACES_LOG_B);
}

function sLog2Encode(linear: number) {
  const reflectedLinear = 0.9 * linear;
  return 0.432699 * Math.log10(Math.max(reflectedLinear + 0.037584, 1e-9)) + 0.616596 + 0.03;
}

function sLog3Encode(linear: number) {
  if (linear >= 0.01125) {
    return (420 + Math.log10((linear + 0.01) / 0.19) * 261.5) / 1023;
  }
  return ((linear * (171.2102946929 - 95)) / 0.01125 + 95) / 1023;
}

function fLogEncode(linear: number) {
  const a = 0.555556;
  const b = 0.009468;
  const c = 0.344676;
  const d = 0.790453;
  const e = 8.735631;
  const f = 0.092864;
  return linear < 0.00089 ? e * linear + f : c * Math.log10(a * linear + b) + d;
}

function fLog2Encode(linear: number) {
  const a = 5.555556;
  const b = 0.064829;
  const c = 0.245281;
  const d = 0.384316;
  const e = 8.799461;
  const f = 0.092864;
  return linear < 0.000889 ? e * linear + f : c * Math.log10(a * linear + b) + d;
}

function nLogEncode(linear: number) {
  const safeLinear = Math.max(linear, 0);
  const a = 650 / 1023;
  const b = 0.0075;
  const c = 150 / 1023;
  const d = 619 / 1023;
  return safeLinear < 0.328 ? safeLinear ** (1 / 3) * a + b : Math.log(safeLinear) * c + d;
}

function logC3Encode(linear: number) {
  const cut = 0.010591;
  const a = 5.555556;
  const b = 0.052272;
  const c = 0.24719;
  const d = 0.385537;
  const e = 5.367655;
  const f = 0.092809;
  return linear > cut ? c * Math.log10(a * linear + b) + d : e * linear + f;
}

const LOG_C4_A = (2 ** 18 - 16) / 117.45;
const LOG_C4_B = (1023 - 95) / 1023;
const LOG_C4_C = 95 / 1023;
const LOG_C4_S = (7 * Math.log(2) * 2 ** (7 - (14 * LOG_C4_C) / LOG_C4_B)) / (LOG_C4_A * LOG_C4_B);
const LOG_C4_T = (2 ** (14 * (-LOG_C4_C / LOG_C4_B) + 6) - 64) / LOG_C4_A;

function logC4Encode(linear: number) {
  if (linear < LOG_C4_T) {
    return (linear - LOG_C4_T) / LOG_C4_S;
  }
  return ((Math.log2(LOG_C4_A * linear + 64) - 6) / 14) * LOG_C4_B + LOG_C4_C;
}

function log3G10Encode(linear: number) {
  const a = 0.224282;
  const b = 155.975327;
  const c = 0.01;
  const g = 15.1927;
  const y = linear + c;
  return y < 0 ? y * g : a * Math.log10(b * y + 1);
}

function lLogEncode(linear: number) {
  if (linear < 0.006) {
    return 8 * linear;
  }
  return 0.233161 * Math.log10(linear / 0.006 + 1) + 0.048;
}

function srgbEncode(linear: number) {
  if (linear <= 0.0031308) {
    return 12.92 * linear;
  }
  return 1.055 * linear ** (1 / 2.4) - 0.055;
}

function srgbDecode(encoded: number) {
  if (encoded <= 0.04045) {
    return encoded / 12.92;
  }
  return ((encoded + 0.055) / 1.055) ** 2.4;
}

function bt709Encode(linear: number) {
  const clamped = Math.max(linear, 0);
  return clamped <= 0.018 ? 4.5 * clamped : 1.099 * clamped ** 0.45 - 0.099;
}

function bt709Decode(encoded: number) {
  const clamped = Math.max(encoded, 0);
  return clamped <= 0.081 ? clamped / 4.5 : ((clamped + 0.099) / 1.099) ** (1 / 0.45);
}

function gamma24Encode(linear: number) {
  return Math.max(linear, 0) ** (1 / 2.4);
}

function gamma24Decode(encoded: number) {
  return Math.max(encoded, 0) ** 2.4;
}

function logC3Decode(encoded: number) {
  const cut = 0.1496;
  const a = 5.555556;
  const b = 0.052272;
  const c = 0.24719;
  const d = 0.385537;
  const e = 5.367655;
  const f = 0.092809;
  return encoded > cut ? (10 ** ((encoded - d) / c) - b) / a : (encoded - f) / e;
}

function logC4Decode(encoded: number) {
  if (encoded < 0) {
    return encoded * LOG_C4_S + LOG_C4_T;
  }
  const p = (14 * (encoded - LOG_C4_C)) / LOG_C4_B + 6;
  return (2 ** p - 64) / LOG_C4_A;
}

const TRANSFER_ENCODERS: Record<string, (linear: number) => number> = {
  acescct: acescctEncode,
  "arri-logc3": logC3Encode,
  logc3: logC3Encode,
  "arri-logc4": logC4Encode,
  logc4: logC4Encode,
  "fujifilm-f-log": fLogEncode,
  "f-log": fLogEncode,
  "fujifilm-f-log2": fLog2Encode,
  "fujifilm-f-log2c": fLog2Encode,
  "f-log2": fLog2Encode,
  "f-log2c": fLog2Encode,
  "nikon-n-log": nLogEncode,
  "n-log": nLogEncode,
  "red-log3g10": log3G10Encode,
  log3g10: log3G10Encode,
  "sony-s-log2": sLog2Encode,
  "s-log2": sLog2Encode,
  "sony-s-log3": sLog3Encode,
  "s-log3": sLog3Encode,
  "leica-l-log": lLogEncode,
  "l-log": lLogEncode,
  srgb: srgbEncode,
  bt709: bt709Encode,
  rec709: bt709Encode,
  bt1886: gamma24Encode,
  "gamma-2-4": gamma24Encode,
  gamma24: gamma24Encode,
  linear: (linear) => linear,
};

const TRANSFER_DECODERS: Record<string, (encoded: number) => number> = {
  acescct: acescctDecode,
  "arri-logc3": logC3Decode,
  logc3: logC3Decode,
  "arri-logc4": logC4Decode,
  logc4: logC4Decode,
  srgb: srgbDecode,
  bt709: bt709Decode,
  rec709: bt709Decode,
  bt1886: gamma24Decode,
  "gamma-2-4": gamma24Decode,
  gamma24: gamma24Decode,
  linear: (encoded) => encoded,
};

function resolveTransferEncoder(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  return TRANSFER_ENCODERS[normalizeId(value)];
}

function resolveTransferDecoder(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  return TRANSFER_DECODERS[normalizeId(value)];
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const normalized = Math.abs(value) < 5e-12 ? 0 : value;
  return Number(normalized.toFixed(10)).toString();
}

function escapeCubeTitle(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function hasCompleteContract(contract: Partial<CubeMetadata>) {
  return Boolean(contract.inputTransfer && contract.inputGamut && contract.outputTransfer && contract.outputGamut);
}

export function canMigrateCubeToAcescctAp1(contract: Partial<CubeMetadata>): LutMigrationSupport {
  if (!hasCompleteContract(contract)) {
    return { supported: false, reason: "missing complete LUT input/output contract" };
  }
  if (!resolveTransferEncoder(contract.inputTransfer)) {
    return { supported: false, reason: `unsupported input transfer ${contract.inputTransfer}` };
  }
  if (!resolveGamutId(contract.inputGamut)) {
    return { supported: false, reason: `unsupported input gamut ${contract.inputGamut}` };
  }
  if (!resolveTransferDecoder(contract.outputTransfer)) {
    return { supported: false, reason: `unsupported output transfer ${contract.outputTransfer}` };
  }
  if (!resolveGamutId(contract.outputGamut)) {
    return { supported: false, reason: `unsupported output gamut ${contract.outputGamut}` };
  }
  return { supported: true };
}

export async function migrateCubeToAcescctAp1(options: AcescctAp1MigrationOptions): Promise<AcescctAp1MigrationResult> {
  const gridSize = options.gridSize ?? DEFAULT_ACES_LUT_SIZE;
  if (!Number.isInteger(gridSize) || gridSize < 2) {
    throw new Error(`ACEScct/AP1 LUT grid size must be an integer >= 2, found ${gridSize}.`);
  }
  const support = canMigrateCubeToAcescctAp1(options.sourceContract);
  if (!support.supported) {
    throw new Error(support.reason ?? "Unsupported LUT migration.");
  }

  const sourceCube = await parseCube3d(options.sourcePath);
  const sourceEncode = resolveTransferEncoder(options.sourceContract.inputTransfer)!;
  const sourceOutputDecode = resolveTransferDecoder(options.sourceContract.outputTransfer)!;
  const inputMatrix = getGamutMatrix(TARGET_INPUT_GAMUT, options.sourceContract.inputGamut!);
  const outputMatrix = getGamutMatrix(options.sourceContract.outputGamut!, TARGET_OUTPUT_GAMUT_MATRIX_ID);
  const max = gridSize - 1;
  const migratedTitle = `${options.title} (ACEScct AP1 ${gridSize})`;
  const lines = [
    `TITLE "${escapeCubeTitle(migratedTitle)}"`,
    `# Generated by LumaForge profiles from ${options.sourceContract.inputGamut} / ${options.sourceContract.inputTransfer}.`,
    `# LUMAFORGE_INPUT_GAMUT: ${TARGET_INPUT_GAMUT}`,
    `# LUMAFORGE_INPUT_TRANSFER: ${TARGET_INPUT_TRANSFER}`,
    `# LUMAFORGE_SOURCE_INPUT_GAMUT: ${options.sourceContract.inputGamut}`,
    `# LUMAFORGE_SOURCE_INPUT_TRANSFER: ${options.sourceContract.inputTransfer}`,
    `LUT_3D_SIZE ${gridSize}`,
    "DOMAIN_MIN 0 0 0",
    "DOMAIN_MAX 1 1 1",
    "",
  ];

  for (let b = 0; b < gridSize; b += 1) {
    for (let g = 0; g < gridSize; g += 1) {
      for (let r = 0; r < gridSize; r += 1) {
        const acesEncoded: Rgb = [r / max, g / max, b / max];
        const acesLinear: Rgb = [
          acescctDecode(acesEncoded[0]),
          acescctDecode(acesEncoded[1]),
          acescctDecode(acesEncoded[2]),
        ];
        const sourceLinear = applyMatrix(inputMatrix, acesLinear);
        const sourceEncoded: Rgb = [
          sourceEncode(sourceLinear[0]),
          sourceEncode(sourceLinear[1]),
          sourceEncode(sourceLinear[2]),
        ];
        const sourceOutputEncoded = sampleCube(sourceCube, sourceEncoded);
        const sourceOutputLinear: Rgb = [
          sourceOutputDecode(sourceOutputEncoded[0]),
          sourceOutputDecode(sourceOutputEncoded[1]),
          sourceOutputDecode(sourceOutputEncoded[2]),
        ];
        const targetOutputLinear = applyMatrix(outputMatrix, sourceOutputLinear);
        const targetOutputEncoded: Rgb = [
          srgbEncode(targetOutputLinear[0]),
          srgbEncode(targetOutputLinear[1]),
          srgbEncode(targetOutputLinear[2]),
        ];
        lines.push(targetOutputEncoded.map(formatNumber).join(" "));
      }
    }
  }

  const metadata: CubeMetadata = {
    title: options.title,
    dimension: "3d",
    size: gridSize,
    domainMin: [0, 0, 0],
    domainMax: [1, 1, 1],
    vendor: options.sourceContract.vendor,
    inputTransfer: TARGET_INPUT_TRANSFER,
    inputGamut: TARGET_INPUT_GAMUT,
    outputTransfer: TARGET_OUTPUT_TRANSFER,
    outputGamut: TARGET_OUTPUT_GAMUT,
    intent: options.sourceContract.intent,
    family: options.sourceContract.family,
    variant: options.sourceContract.variant,
    contractSource: "acescct-ap1-migration",
    contractSourceId: `${options.sourceContract.contractSourceId ?? "manual"}:acescct-ap1-${gridSize}`,
    contractConfidence: options.sourceContract.contractConfidence ?? "medium",
    sourceInputTransfer: options.sourceContract.inputTransfer,
    sourceInputGamut: options.sourceContract.inputGamut,
    sourceOutputTransfer: options.sourceContract.outputTransfer,
    sourceOutputGamut: options.sourceContract.outputGamut,
    sourceLutSize: sourceCube.size,
    sourceContractSource: options.sourceContract.contractSource,
    sourceContractSourceId: options.sourceContract.contractSourceId,
  };

  return {
    cubeText: `${lines.join("\n")}\n`,
    metadata,
  };
}
