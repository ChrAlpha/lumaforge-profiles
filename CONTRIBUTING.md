# Contributing

LumaForge Profiles is a multi-license registry. Contributions must make every
asset's copyright, source, license, and redistribution status explicit.

## Required Model

Entries live under flattened directories:

```text
profiles/
  lut.lumaforge.neutral-rec709.v1/
    manifest.json
    assets/
      neutral-rec709.cube
    LICENSE
    NOTICE.md
```

Do not add category-based loader assumptions such as `profiles/luts`,
`profiles/cameras`, or `profiles/lenses`. Tools and consumers must use
`profiles/*/manifest.json` or the explicit entries in
`lumaforge-profiles.json`.

Asset files under `profiles/*/assets/` are intentionally git ignored. Commit
the manifest, schema changes, license files, notice files, docs, and tooling;
do not commit large `.cube`, `.dcp`, or `.lcp` assets.

## Asset Certification

By contributing a profile asset or manifest, you certify that:

1. You created the asset yourself, or you have the right to submit it.
2. The asset may be redistributed through this repository and GitHub Releases.
3. The manifest license information is accurate.
4. The manifest author and source fields identify provenance clearly.
5. Required attribution, modification notes, and license files are included.

## Prohibited Sources

Do not submit resources copied from Adobe, Lightroom, Camera Raw, Photoshop,
DaVinci Resolve, Capture One, DxO, camera vendor software, commercial LUT
packs, paid downloads, trial-only packages, firmware bundles, SDK packages, or
personal-use-only downloads unless their license explicitly permits
redistribution through this registry.

Unlicensed, proprietary, personal-use-only, non-redistributable, or unclear
assets are not accepted.

## Manifest Requirements

Every entry must include `manifest.json` with at least:

- `id`
- `kind`
- `format`
- `version`
- `title`
- `license`
- `author`
- `source`
- `sourceUrl`
- `redistributionAllowed`
- `targets`
- `assets[].path`
- `assets[].byteSize`
- `assets[].sha256`

First-party assets should normally use:

```json
{
  "license": "CC0-1.0",
  "author": "LumaForge contributors",
  "source": "original",
  "redistributionAllowed": true
}
```

Local imports without explicit rights default to:

```json
{
  "license": "NOASSERTION",
  "author": "Unknown",
  "source": "local-import",
  "redistributionAllowed": false
}
```

That is acceptable while organizing files locally, but it is not acceptable for
release.

## Validation and Release Gate

Run:

```bash
pnpm profiles validate
pnpm profiles validate --release
```

The release gate rejects entries when:

- `redistributionAllowed` is not `true`
- `license` is missing, `NOASSERTION`, or `UNLICENSED`
- `author` is missing
- any asset is missing
- any asset is missing `sha256`
- any asset hash or byte size differs from the manifest
- any asset path escapes its entry directory

`pnpm profiles pack --tag <tag>` runs the release gate before creating zip
packs. `pnpm profiles release --tag <tag>` defaults to dry-run and only
executes GitHub CLI commands when `--yes` is supplied.

## Pull Request Checklist

- The entry has a flattened `profiles/<entry-dir>/manifest.json`.
- The manifest declares clear source, author, license, and redistribution
  permission.
- The license permits redistribution through this repository.
- Required attribution is included in `NOTICE.md`.
- Required license text is included in `LICENSE` or `LICENSES/`.
- No large profile asset is committed to Git history.
- `pnpm test` passes.
- `pnpm profiles validate --release` passes for releasable entries.
