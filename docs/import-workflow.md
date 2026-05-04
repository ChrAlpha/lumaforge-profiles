# Import workflow

This document covers the automated import path. It is useful for bulk local
staging, reviewed vendor packages, and ACEScct/AP1 migration experiments. It is
not the primary path for maintainers who prefer to hand curate
`profiles/*/manifest.json`; for that flow, see
[lut-only-s3-self-hosting.md](lut-only-s3-self-hosting.md).

## Import and flatten

Install dependencies:

```bash
pnpm install
```

Recommended import workflow:

```bash
# 1. Put local resources in an ignored drop zone
mkdir -p .local-profile-imports

# 2. Import and flatten into profile entries
pnpm profiles:import \
  --from .local-profile-imports \
  --namespace lumaforge \
  --author "LumaForge contributors" \
  --license CC0-1.0 \
  --redistribution-allowed \
  --migrate-luts-to-acescct-ap1

# 3. Validate manifests and local assets
pnpm profiles:validate

# 4. Regenerate the repository index
pnpm profiles:index

# 5. Build S3/CDN release artifacts
pnpm profiles:build-s3 --tag v2026.04.29 --public-base-url https://profiles.lumaforge.invalid --channel stable

# 6. Dry-run the S3 publish plan
pnpm profiles:publish-s3:dry-run --tag v2026.04.29 --channel stable

# 7. Publish immutable blobs and channel aliases
pnpm profiles:publish-s3 --tag v2026.04.29 --channel stable

# 8. Inspect or execute garbage collection
pnpm profiles:s3:gc --keep-releases 3 --dry-run
```

The import command recursively scans `.cube`, `.dcp`, `.icc`, `.lcp`, and
JSON-based profile files, copies them into `profiles/<entry-dir>/assets/`, and
writes or updates each `manifest.json`. Existing manifests keep curated
metadata by default while asset hash, size, and path metadata are refreshed.

If license, author, or redistribution flags are omitted during import, the tool
writes conservative local-only defaults:

```json
{
  "license": "NOASSERTION",
  "author": "Unknown",
  "source": "local-import",
  "redistributionAllowed": false
}
```

These entries are allowed locally but cannot be published as release assets.

## LUT contracts

For LUTs, import records parsed `.cube` table metadata under `lut`.
Camera-log LUTs should carry an explicit render contract:

```json
{
  "lut": {
    "dimension": "3d",
    "size": 33,
    "inputTransfer": "arri-logc3",
    "inputGamut": "arri-wide-gamut-3",
    "outputTransfer": "srgb",
    "outputGamut": "rec709",
    "intent": "look",
    "family": "arri-look-library",
    "variant": "1110-black-and-white",
    "contractSource": "source-package-rule",
    "contractSourceId": "arri-look-library-logc3-to-rec709",
    "contractConfidence": "high"
  }
}
```

Camera-log LUTs with different input curves are separate contracts, not
duplicate assets. The importer uses curated source-package rules for the
reviewed local vendor packages currently under `.local-profile-imports/`:
`arri`, `autel-robotics`, `dji`, `filmic-pro`, `fujifilm`, `insta360`,
`leica`, `nikon`, `om-system`, `panasonic`, `red`, and `sony`. A rule may add
the input/output contract and append a readable contract suffix to the entry
slug so same-name looks do not collapse into hash-only collisions.

The `.cube` parser intentionally does not treat free-form comments as trusted
contract metadata. If no source-package rule matches, imported LUTs stay
unresolved until a maintainer edits the manifest or adds a new reviewed source
rule. Kinefinity currently stays in that unresolved bucket: `.cube` assets can
be staged, but `.look` sidecars are ignored and no reviewed contract rule is
applied yet. GoPro also remains outside the reviewed rule set until a stable
official package is mirrored locally and the contract can be reviewed.
Maintainers should still review vendor terms and contract metadata before
marking an entry redistributable.

## ACEScct/AP1 migration

When `--migrate-luts-to-acescct-ap1` is enabled, supported imported `.cube`
LUTs with complete reviewed input/output contracts are baked into canonical
ACES AP1 / ACEScct `65^3` assets. The generated manifest changes the LUT input
contract to `inputGamut: "aces-ap1"` and `inputTransfer: "acescct"`, bakes the
source LUT output into `outputGamut: "rec709"` and `outputTransfer: "srgb"`, and
records the source input/output contract under `source*` metadata fields. LUTs
without a complete trusted contract, with an unsupported transfer/gamut, or with
invalid cube data are left as ordinary imports and reported as skipped by the
CLI. This migration does not change the license or redistribution flags; unclear
third-party assets remain local-only.
