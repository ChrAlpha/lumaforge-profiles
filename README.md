# lumaforge-profiles

LumaForge Profiles is a manifest-first registry for LUTs, DNG camera profiles,
lens correction profiles, and related RAW pipeline profile metadata.

The repository tracks metadata, schemas, documentation, and tooling. Large
profile assets are kept out of Git history and are distributed as individual
GitHub Release assets.

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
  --redistribution-allowed

# 3. Validate manifests and local assets
pnpm profiles:validate

# 4. Regenerate the repository index
pnpm profiles:index

# 5. Build GitHub Release assets
pnpm profiles:build-release --tag v2026.04.28 --repo lumaforge/lumaforge-profiles

# 6. Dry-run GitHub release commands
pnpm profiles:release:dry-run --tag v2026.04.28 --repo lumaforge/lumaforge-profiles

# 7. Publish a draft release
pnpm profiles:release --tag v2026.04.28 --repo lumaforge/lumaforge-profiles --draft
```

The import command recursively scans `.cube`, `.dcp`, and `.lcp` files, copies
them into `profiles/<entry-dir>/assets/`, and writes or updates each
`manifest.json`. Existing manifests keep curated metadata by default while
asset hash, size, and path metadata are refreshed.

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

ARRI LogC3/LogC4 and Fujifilm F-Log/F-Log2/F-Log2 C LUTs are separate
contracts, not duplicate assets. The importer uses curated source-package rules
for known vendor package roots such as `arri/look-library-logc3-to-rec709` and
`arri/look-library-logc4-log-to-log`. A rule may add the input/output contract
and append a readable contract suffix to the entry slug so same-name looks do
not collapse into hash-only collisions.

The `.cube` parser intentionally does not treat free-form comments as trusted
contract metadata. If no source-package rule matches, imported LUTs stay
unresolved until a maintainer edits the manifest or adds a new reviewed source
rule. Maintainers should still review vendor terms and contract metadata before
marking an entry redistributable.

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

## Release Assets

`pnpm profiles:build-release --tag <tag> --repo <owner/name>` runs release
validation and writes:

```text
dist/release/<tag>/
  lumaforge-profiles.<tag>.index.json
  lumaforge-profiles.<tag>.checksums.txt
  RELEASE_NOTES.md
  assets/
    asset.lut.lumaforge.neutral-rec709.v1.cube
    asset.camera.sony.ilce-7m4.v1.dcp
    asset.lens.sony.fe-24-70mm-f2-8-gm-ii.v1.lcp
  entries/
    entry.lut.lumaforge.neutral-rec709.v1.manifest.json
    entry.camera.sony.ilce-7m4.v1.manifest.json
    entry.lens.sony.fe-24-70mm-f2-8-gm-ii.v1.manifest.json
```

Each file under `assets/` is uploaded as its own GitHub Release asset. The
release index contains the direct download URL, size, sha256, media type, role,
and release asset name for every runtime asset. The release command uploads the
already-built files; it does not repackage them.

Release validation fails closed for entries with unclear redistribution terms,
missing authors, missing assets, missing hashes, byte-size mismatches, or hash
mismatches.

## Runtime Loading

GitHub Releases are used as an asset store. The Git repository stores
manifests, schemas, tools, and docs. Large profile binaries should stay out of
Git history. Each runtime asset is published as an individual GitHub Release
asset.

The default runtime contract is:

```text
1. LumaForge downloads lumaforge-profiles.<tag>.index.json.
2. The UI lists compatible LUT, camera profile, and lens profile entries from
   the index.
3. When the user selects one LUT, DCP, or LCP, runtime downloads only that
   entry asset's download.url.
4. Runtime verifies sha256 before loading.
5. Verified bytes are cached in Cache Storage or IndexedDB by sha256.
6. Later requests for the same sha256 read from local cache.
7. Runtime does not download a full archive, vendor archive, model archive, or
   mount archive to load one profile.
```

Runtime should filter LUT entries by `lut.inputTransfer` and `lut.inputGamut`
when the RAW pipeline knows its target log curve and gamut. If compatibility is
unknown, group by `lut.vendor` and `lut.inputTransfer` so users can distinguish
ARRI / LogC3 from ARRI / LogC4 or Fujifilm / F-Log2 from Fujifilm / F-Log2 C.
Manual selection of a mismatched LUT should be treated as an explicit override,
not as a silent compatibility match.

Bulk archives, if ever generated by a separate offline mirroring workflow, are
offline-only and are not part of the default runtime path.

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
