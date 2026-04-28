# lumaforge-profiles

LumaForge Profiles is a manifest-first registry for LUTs, DNG camera profiles,
lens correction profiles, and related RAW pipeline profile metadata.

The repository tracks metadata, schemas, documentation, and tooling. Large
profile assets are kept out of Git history and are distributed as GitHub
Release asset packs.

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
validation and release packaging, but they should not be committed.

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
pnpm profiles import \
  --from .local-profile-imports \
  --namespace lumaforge \
  --author "LumaForge contributors" \
  --license CC0-1.0 \
  --redistribution-allowed

# 3. Validate manifests and local assets
pnpm profiles validate

# 4. Regenerate the repository index
pnpm profiles index

# 5. Build GitHub Release assets
pnpm profiles pack --tag profiles-2026.04.0

# 6. Dry-run GitHub release commands
pnpm profiles release --tag profiles-2026.04.0 --dry-run

# 7. Publish a draft release
pnpm profiles release --tag profiles-2026.04.0 --draft --yes
```

The import command recursively scans `.cube`, `.dcp`, and `.lcp` files, copies
them into `profiles/<entry-dir>/assets/`, and writes or updates each
`manifest.json`. Existing manifests keep curated metadata by default while
asset hash, size, and path metadata are refreshed.

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

These entries are allowed locally but cannot be packed for release.

## Release Packs

`pnpm profiles pack --tag <tag>` runs release validation and writes:

```text
dist/release/<tag>/
  lumaforge-profiles-<tag>-all.zip
  lumaforge-profiles-<tag>-luts.zip
  lumaforge-profiles-<tag>-dcp.zip
  lumaforge-profiles-<tag>-lcp.zip
  release-manifest.json
  SHA256SUMS
  RELEASE_NOTES.md
```

Each zip contains a pack-scoped `lumaforge-profiles.json`,
`pack-manifest.json`, selected entry manifests, selected assets, and local
`LICENSE` or `NOTICE.md` files when present.

Release validation fails closed for entries with unclear redistribution terms,
missing authors, missing assets, missing hashes, byte-size mismatches, or hash
mismatches.

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
