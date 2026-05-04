# lumaforge-profiles

LumaForge Profiles is a manifest-first registry for LUTs, DNG camera profiles,
lens correction profiles, and related RAW pipeline profile metadata.

The repository tracks metadata, schemas, documentation, and tooling. Large
profile assets are kept out of Git history and are distributed through
Cloudflare R2 with a Cloudflare custom-domain CDN in front.

## Design

Profile entries are flattened under `profiles/*/manifest.json`:

```text
lumaforge-profiles.json
profiles/
  lut.lumaforge.neutral-rec709.v1/
    manifest.json
    assets/
      neutral-rec709.cube
    LICENSE
    NOTICE.md
```

Paths are storage only. The entry `manifest.json` owns semantics such as kind,
format, targets, license, source, author, redistribution permission, asset
hashes, and media types. Loaders should use the top-level
`lumaforge-profiles.json` entries or scan `profiles/*/manifest.json`; they
should not depend on category directories such as `profiles/luts` or
`profiles/cameras`.

Assets under `profiles/*/assets/` are git ignored. They can exist locally for
validation and release building, but they should not be committed.

## Tooling

Install dependencies:

```bash
pnpm install
```

Recommended workflow:

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

# 5. Build R2/CDN release artifacts
pnpm profiles:build-r2 --tag v2026.04.29 --public-base-url https://profiles.lumaforge.invalid --channel stable

# 6. Dry-run the R2 publish plan
pnpm profiles:publish-r2:dry-run --tag v2026.04.29 --channel stable

# 7. Publish immutable blobs and channel aliases
pnpm profiles:publish-r2 --tag v2026.04.29 --channel stable

# 8. Inspect or execute garbage collection
pnpm profiles:r2:gc --keep-releases 3 --dry-run
```

The import command recursively scans `.cube`, `.dcp`, `.icc`, `.lcp`, and
JSON-based profile files, copies them into `profiles/<entry-dir>/assets/`, and
writes or updates each `manifest.json`. Existing manifests keep curated
metadata by default while asset hash, size, and path metadata are refreshed.

For LUTs, import also records parsed `.cube` table metadata under `lut`.
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

For expert maintainers who only want to curate and share their own LUT catalog
from a fork, use the LUT-only R2/S3 flow:

```bash
pnpm profiles:import --from .local-profile-imports --lut-only --namespace your-name
pnpm profiles:validate --lut-only --release
pnpm profiles:build-r2 --lut-only --tag v2026.05.04 --public-base-url https://profiles.example.com --channel stable
pnpm profiles:publish-r2:dry-run --tag v2026.05.04 --channel stable
```

See [docs/lut-only-r2-self-hosting.md](docs/lut-only-r2-self-hosting.md).

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

If license, author, or redistribution flags are omitted during import, the
tool writes conservative local-only defaults:

```json
{
  "license": "NOASSERTION",
  "author": "Unknown",
  "source": "local-import",
  "redistributionAllowed": false
}
```

These entries are allowed locally but cannot be published as release assets.

## R2 Release Artifacts

`pnpm profiles:build-r2 --tag <tag> --public-base-url <url>` runs release
validation and writes:

```text
dist/r2-release/<tag>/
  catalog.json
  release.json
  blobs-manifest.json
  publish-plan.json
  checksums.txt
  entries/
    org.lumaforge.lut.neutral-rec709.json
    org.lumaforge.camera.sony.ilce-7m4.json
    org.lumaforge.lens.sony.fe-24-70mm-f2-8-gm-ii.json
```

Immutable runtime assets are content-addressed blobs under
`blobs/sha256/<aa>/<bb>/<sha256>.<ext>`. `catalog.json` is the small runtime
entry point, `entries/*.json` hold full manifest metadata, and
`blobs-manifest.json` records the exact blob references used by the release for
auditing and GC.

`publish-plan.json` lists the release objects, keys, cache headers, and upload
phases. `checksums.txt` provides local audit hashes for the generated release
artifacts.

Release validation fails closed for entries with unclear redistribution terms,
missing authors, missing assets, missing hashes, byte-size mismatches, or hash
mismatches.

## Runtime Loading

In the legacy GitHub Release model, profiles were effectively maintained
through the repository and its release attachments. In the R2/S3 model, the
published profile registry is also maintained through the bucket itself:
versioned catalogs, channel pointers, and immutable blobs live there, while the
Git repository remains the authoring and tooling surface for manifests,
schemas, docs, and release workflows. Cloudflare CDN then serves those bucket
objects through public cached URLs.

The default runtime contract is:

```text
1. LumaForge downloads channels/stable/catalog.json (or a pinned release catalog).
2. The UI lists compatible LUT, camera profile, and lens profile entries from
   the catalog.
3. When the user selects one LUT, DCP, ICC, LCP, or JSON-based profile, runtime
   downloads only that entry's primaryAsset.url.
4. Runtime verifies sha256 before loading.
5. Verified bytes are cached in Cache Storage or IndexedDB by sha256.
6. Later requests for the same sha256 read from local cache.
7. Runtime does not download a full archive, vendor archive, model archive, or
   mount archive to load one profile.
8. Runtime does not call R2 management APIs, LIST, or HEAD to discover assets.
```

Runtime should filter LUT entries by `lut.inputTransfer` and `lut.inputGamut`
when the RAW pipeline knows its target log curve and gamut. If compatibility is
unknown, group by `lut.vendor` and `lut.inputTransfer` so users can distinguish
ARRI / LogC3 from ARRI / LogC4 or Fujifilm / F-Log2 from Fujifilm / F-Log2 C.
Manual selection of a mismatched LUT should be treated as an explicit override,
not as a silent compatibility match.

Bulk archives, if ever generated by a separate offline mirroring workflow, are
offline-only and are not part of the default runtime path.

## Distribution Strategy

```text
The Git repository is the authoring surface for manifests, schemas, tools, and docs.
Cloudflare R2 is the published registry surface for immutable profile blobs, versioned release catalogs, and mutable channel pointers.
Cloudflare CDN serves public profile URLs with aggressive edge caching.
Content-addressed blobs are reused across releases to reduce storage and write operations.
Mutable channel files (stable/latest) are small and updated last.
```

Cache policy defaults:

- `blobs/*` -> `Cache-Control: public, max-age=31536000, immutable`
- `releases/<tag>/*.json` -> `Cache-Control: public, max-age=86400, immutable`
- `channels/<name>/*.json` -> `Cache-Control: public, max-age=60, stale-while-revalidate=600`

Because Cloudflare's default file-extension cache list does not naturally cover
profile formats like `.cube`, `.dcp`, or `.lcp`, production setup should add a
Cache Rule or equivalent "cache everything" policy for the custom domain.

See [docs/cloudflare-r2-setup.md](docs/cloudflare-r2-setup.md) and
[.env.example](.env.example) for bucket, custom-domain, CORS, and channel setup.

## Legacy GitHub Path

The older `profiles:build-release` / `profiles:release` GitHub Release path is
kept as a compatibility fallback. The default runtime and publishing workflow
should use `build-r2`, `publish-r2`, and `r2-gc`.

## Compatibility

Third-party registries can be compatible without using this tooling. They only
need to provide either:

- a top-level `lumaforge-profiles.json` with explicit entry paths, or
- flattened `profiles/*/manifest.json` entries that a loader can scan.

Do not bind consumers to repository-specific storage categories. The manifest
schema is the compatibility contract.

## Repository Layout

```text
lumaforge-profiles.json          Generated registry index
profiles/                        Flattened profile entries
schemas/                         JSON schemas
src/                             TypeScript CLI and library modules
test/                            Vitest coverage
LICENSE.md                       Multi-license policy
LICENSES/                        Bundled license texts
COPYRIGHT_POLICY.md              Asset acceptance and provenance policy
CONTRIBUTING.md                  Contributor certification and PR checklist
NOTICE.md                        Repository-level notice index
```

See [LICENSE.md](LICENSE.md), [COPYRIGHT_POLICY.md](COPYRIGHT_POLICY.md), and
[CONTRIBUTING.md](CONTRIBUTING.md) before adding any profile asset.
