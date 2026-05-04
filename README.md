# lumaforge-profiles

Languages: [English](README.md) | [简体中文](README.zh-CN.md)

Manifest-first tooling for maintaining and publishing small LUT catalogs for
the LumaForge RAW pipeline.

The common use case is a fork maintained by one person or a small group: keep a
curated set of `.cube` LUTs, publish them to your own S3-compatible bucket,
and share the public catalog URL yourself. LumaForge does not authenticate,
review, operate, or endorse third-party forks.

## Quick Start

```bash
pnpm install

mkdir -p profiles/lut.your-name.manual-warm.v1/assets
cp /path/to/manual-warm.cube profiles/lut.your-name.manual-warm.v1/assets/manual-warm.cube
cp examples/manifests/first-party-lut.manifest.json profiles/lut.your-name.manual-warm.v1/manifest.json
```

Edit `profiles/lut.your-name.manual-warm.v1/manifest.json`:

- set `id`, `title`, `license`, `author`, `source`, and `sourceUrl`;
- keep `kind: "lut"` and `format: "cube"`;
- point `assets[0].path` at your `.cube` file;
- write the LUT contract under `lut` from reviewed knowledge, not filename
  guesses;
- set `redistributionAllowed` only when you are allowed to redistribute the LUT.

Then refresh generated asset metadata and publish:

```bash
pnpm profiles:refresh-assets --lut-only
pnpm profiles:validate --lut-only --release
pnpm profiles:build-s3 --lut-only --tag v2026.05.04 --public-base-url https://profiles.example.com --channel stable
pnpm profiles:publish-s3:dry-run --tag v2026.05.04 --channel stable
pnpm profiles:publish-s3 --tag v2026.05.04 --channel stable
```

Share one of these public URLs:

```text
https://profiles.example.com/channels/stable/catalog.json
https://profiles.example.com/releases/v2026.05.04/catalog.json
```

Channel URLs receive future updates. Release URLs are pinned snapshots.

## Repository Shape

Profile entries are flattened under `profiles/*/manifest.json`:

```text
lumaforge-profiles.json
profiles/
  lut.your-name.manual-warm.v1/
    manifest.json
    assets/
      manual-warm.cube
    LICENSE
    NOTICE.md
```

Paths are storage only. The manifest owns semantics such as `kind`, `format`,
license, source, author, redistribution permission, asset hashes, media types,
and LUT input/output contract. Loaders should read `lumaforge-profiles.json` or
scan `profiles/*/manifest.json`; they should not depend on category
directories such as `profiles/luts`.

Assets under `profiles/*/assets/` are git ignored. They can exist locally for
validation and release building, but they should not be committed.

## Maintainer Commands

```bash
pnpm profiles:refresh-assets --lut-only
pnpm profiles:validate --lut-only --release
pnpm profiles:index
pnpm profiles:build-s3 --lut-only --tag <tag> --public-base-url <url> --channel stable
pnpm profiles:publish-s3:dry-run --tag <tag> --channel stable
pnpm profiles:publish-s3 --tag <tag> --channel stable
pnpm profiles:s3:gc --keep-releases 3 --dry-run
```

`profiles:refresh-assets` updates only `assets[].byteSize`,
`assets[].sha256`, and `updatedAt` for existing manifests. It does not create
entries, import loose files, rename directories, or infer LUT contracts.

`--lut-only` fails closed when a non-LUT manifest is present. Use it for
LUT-only forks so camera or lens profile entries do not accidentally enter a
shared catalog.

Publishing reads generic `S3_*` variables from `.env` or the shell:
`S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, and optional
`S3_FORCE_PATH_STYLE`.

## Distribution Model

The S3-compatible publisher writes:

```text
blobs/sha256/<aa>/<bb>/<sha256>.cube
releases/<tag>/catalog.json
releases/<tag>/entries/<entry-id>.json
releases/<tag>/release.json
releases/<tag>/blobs-manifest.json
channels/stable/catalog.json
channels/stable/release.json
```

Blob URLs are immutable and content-addressed. Channel files are mutable and
updated last so a channel does not point at a half-uploaded release.

Release validation fails closed for unclear redistribution terms, missing
authors, missing assets, missing hashes, byte-size mismatches, and hash
mismatches.

## Important Boundaries

- A shared catalog URL is public to anyone who has or receives it.
- This repository does not provide authentication or access control.
- Downloaded LUTs are not safe to publish unless their license permits
  redistribution.
- Third-party assets keep their original license and must include clear
  provenance.
- Unknown LUT contracts should stay local until the maintainer verifies the
  intended input and output color handling.

## More Docs

- [LUT-only S3 self-hosting](docs/lut-only-s3-self-hosting.md)
- [Cloudflare R2 setup](docs/cloudflare-r2-setup.md)
- [Automated import workflow](docs/import-workflow.md)
- [Official LUT source inventory](docs/official-lut-source-inventory.md)
- [Copyright policy](COPYRIGHT_POLICY.md)
- [Contributing guide](CONTRIBUTING.md)

## Compatibility

Third-party registries can be compatible without using this tooling. They only
need to provide either:

- a top-level `lumaforge-profiles.json` with explicit entry paths, or
- flattened `profiles/*/manifest.json` entries that a loader can scan.

The manifest schema is the compatibility contract.
