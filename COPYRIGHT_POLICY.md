# Copyright Policy

LumaForge Profiles accepts only assets that can be redistributed by this
repository under clear terms.

This policy is project guidance for contributors and maintainers. It is not
legal advice.

## Default Model

- First-party profile assets are dedicated under CC0-1.0 unless their manifest
  declares otherwise.
- Repository tooling is licensed under MIT.
- LumaForge-authored documentation, schemas, manifests, and index data are
  dedicated under CC0-1.0.
- Third-party assets keep their original license and must include explicit
  redistribution permission.
- Unlicensed, proprietary, personal-use-only, non-redistributable, or unclear
  assets are not accepted.

## Required Provenance

Every profile asset must include a `manifest.json` with at least:

- `id`
- `kind`
- `title`
- `license`
- `author`
- `source`
- `redistributionAllowed`
- `derivativeOf`
- `copyright`

Third-party assets must also include enough information for maintainers and
downstream users to audit the source, such as a source URL, source commit or
release when available, required attribution, and modification notes.

## Prohibited Sources

Do not submit assets copied or extracted from:

- commercial LUT packs;
- paid, bundled, or trial-only creative software;
- DaVinci Resolve, Lightroom, Camera Raw, Capture One, DxO, Photoshop, or
  similar software packages unless the vendor license explicitly permits
  redistribution;
- camera vendor software, SDKs, ICC/DCP/profile packages, or firmware unless
  the vendor license explicitly permits redistribution;
- YouTube descriptions, forum posts, file-sharing links, or personal websites
  that do not provide a clear license and redistribution grant;
- free downloads whose terms say personal use only, no redistribution, no
  resale, or no modification.

## LUTs

Accepted LUTs must be first-party, public-domain, CC0, CC-BY, MIT-compatible,
or otherwise explicitly redistributable. A downloadable LUT is not acceptable
unless its license permits redistribution in this repository.

## Camera Profiles

Camera profiles require extra review. Adobe DCP profiles, camera vendor
profiles, and profiles extracted from proprietary RAW processors must not be
committed unless their license clearly permits redistribution.

Safer submissions include first-party profiles generated from public test
targets, original measurements, or reproducible recipes. When the original
profile cannot be redistributed, submit only metadata and a generation recipe.

## Lens Correction Data

Lens correction data imported from projects such as Lensfun, darktable, or
RawTherapee must preserve the original license, authors, source URL, source
commit, attribution requirements, and modification history.

Share-alike or reciprocal license obligations must be isolated in the
resource's directory and made explicit in its manifest and NOTICE file.

## Review Rule

When in doubt, do not merge the asset. Ask for clearer provenance, a more
specific license grant, or a first-party regeneration path.
