import { migrateCubeToAcescctAp1 } from "../src/import/aces-migration";
import { createTempRepo, writeFixture } from "./helpers";

function identityCube(size: number) {
  const lines = [
    'TITLE "Identity"',
    `LUT_3D_SIZE ${size}`,
    "DOMAIN_MIN 0 0 0",
    "DOMAIN_MAX 1 1 1",
    "",
  ];
  const max = size - 1;
  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        lines.push(`${r / max} ${g / max} ${b / max}`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

function cubeDataRows(cubeText: string) {
  return cubeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^-?(?:\d|\.)/.test(line))
    .map((line) => line.split(/\s+/).map(Number));
}

function srgbEncode(linear: number) {
  if (linear <= 0.0031308) {
    return 12.92 * linear;
  }
  return 1.055 * linear ** (1 / 2.4) - 0.055;
}

describe("ACEScct/AP1 LUT migration", () => {
  test("bakes a source cube into an ACEScct/AP1 grid while recording the source contract", async () => {
    const root = await createTempRepo();
    const sourcePath = await writeFixture(
      root,
      "imports/source.cube",
      identityCube(2),
    );

    const migrated = await migrateCubeToAcescctAp1({
      sourcePath,
      title: "Canonical Identity",
      gridSize: 3,
      sourceContract: {
        inputTransfer: "acescct",
        inputGamut: "aces-ap1",
        outputTransfer: "srgb",
        outputGamut: "rec709",
        contractSource: "source-package-rule",
        contractSourceId: "fixture",
      },
    });

    expect(migrated.metadata).toMatchObject({
      dimension: "3d",
      size: 3,
      domainMin: [0, 0, 0],
      domainMax: [1, 1, 1],
      inputTransfer: "acescct",
      inputGamut: "aces-ap1",
      outputTransfer: "srgb",
      outputGamut: "rec709",
      contractSource: "acescct-ap1-migration",
      sourceInputTransfer: "acescct",
      sourceInputGamut: "aces-ap1",
      sourceContractSourceId: "fixture",
    });
    expect(migrated.cubeText).toContain('TITLE "Canonical Identity (ACEScct AP1 3)"');
    expect(migrated.cubeText).toContain("LUT_3D_SIZE 3");

    const rows = cubeDataRows(migrated.cubeText);
    expect(rows).toHaveLength(27);
    expect(rows[0]).toEqual([0, 0, 0]);
    expect(rows[1]![0]).toBeCloseTo(0.5, 8);
    expect(rows[1]![1]).toBeCloseTo(0, 8);
    expect(rows[1]![2]).toBeCloseTo(0, 8);
  });

  test("normalizes migrated LUT output to sRGB Rec.709", async () => {
    const root = await createTempRepo();
    const sourcePath = await writeFixture(
      root,
      "imports/bt1886-output.cube",
      identityCube(2),
    );

    const migrated = await migrateCubeToAcescctAp1({
      sourcePath,
      title: "BT1886 Output",
      gridSize: 3,
      sourceContract: {
        inputTransfer: "acescct",
        inputGamut: "aces-ap1",
        outputTransfer: "bt1886",
        outputGamut: "rec709",
        contractSource: "source-package-rule",
        contractSourceId: "fixture-bt1886",
      },
    });

    expect(migrated.metadata).toMatchObject({
      inputTransfer: "acescct",
      inputGamut: "aces-ap1",
      outputTransfer: "srgb",
      outputGamut: "rec709",
      sourceOutputTransfer: "bt1886",
      sourceOutputGamut: "rec709",
    });

    const rows = cubeDataRows(migrated.cubeText);
    expect(rows[1]![0]).toBeCloseTo(srgbEncode(0.5 ** 2.4), 8);
    expect(rows[1]![1]).toBeCloseTo(0, 8);
    expect(rows[1]![2]).toBeCloseTo(0, 8);
  });

  test("does not emit NaN values when a source log encoder cannot represent negative ACES toe values", async () => {
    const root = await createTempRepo();
    const sourcePath = await writeFixture(
      root,
      "imports/nikon.cube",
      identityCube(2),
    );

    const migrated = await migrateCubeToAcescctAp1({
      sourcePath,
      title: "Nikon Identity",
      gridSize: 2,
      sourceContract: {
        inputTransfer: "nikon-n-log",
        inputGamut: "rec2020",
        outputTransfer: "bt1886",
        outputGamut: "rec709",
      },
    });

    expect(migrated.cubeText).not.toContain("NaN");
    expect(cubeDataRows(migrated.cubeText)).toHaveLength(8);
  });
});
