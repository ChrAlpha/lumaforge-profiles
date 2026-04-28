# Contributing

LumaForge Profiles is a multi-license profile registry. Contributions must make
their copyright and license status explicit.

## Asset Certification

By contributing a profile asset, you certify that:

1. You created the asset yourself, or you have the right to submit it.
2. The asset may be redistributed in this repository.
3. The license information in the manifest is accurate.
4. The asset is not copied from proprietary software, paid LUT packs, camera
   vendor packages, or other sources that prohibit redistribution.

## Required Asset Layout

Each asset should live in its own directory:

```text
profiles/
  luts/
    neutral-rec709-v1/
      neutral-rec709-v1.cube
      manifest.json
      LICENSE
      NOTICE.md
```

Use the closest matching category under `profiles/`, such as `luts/`,
`camera-profiles/`, `lens-profiles/`, or `calibration-data/`.

## Manifest Requirements

Every asset directory must include `manifest.json`. The manifest must declare
the resource's source, author, license, and redistribution status. See
[`schemas/profile-manifest.schema.json`](schemas/profile-manifest.schema.json)
for the minimal schema and [`examples/manifests/`](examples/manifests/) for
examples.

First-party assets should normally use:

```json
{
  "license": "CC0-1.0",
  "author": "LumaForge contributors",
  "source": "original",
  "redistributionAllowed": true
}
```

Third-party assets must preserve their original license and include source
details, required attribution, and any modification notes.

## Licenses and Notices

- Add a resource-local `LICENSE` file when the asset's license requires it or
  when the terms are not already bundled under `LICENSES/`.
- Add a resource-local `NOTICE.md` for attribution, provenance notes, source
  commit or release information, and modification history.
- Do not rely on the repository's default MIT or CC0 terms for third-party
  assets.

## Pull Request Checklist

- The asset has a `manifest.json`.
- `redistributionAllowed` is `true`.
- The license permits redistribution in this repository.
- Required attribution is included in `NOTICE.md`.
- The source URL, source commit, release, or generation recipe is recorded.
- No file was copied from proprietary software, paid LUT packs, camera vendor
  packages, or personal-use-only downloads.
