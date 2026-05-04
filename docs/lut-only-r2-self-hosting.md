# LUT-only R2/S3 self-hosting

This workflow is for maintainers who fork this repository, curate their own
small LUT set, publish it to their own R2/S3-compatible bucket, and share the
resulting public catalog or channel URL themselves.

It is not an official LumaForge LUT channel. LumaForge does not authenticate,
endorse, review, or operate third-party forks. If a catalog URL is reachable, it
is public to anyone who has or receives that link.

## Scope

Use this path when:

- the fork only intends to distribute `.cube` LUT entries;
- the maintainer is comfortable reviewing LUT contracts and licenses;
- distribution happens through the maintainer's own R2/S3 bucket and public CDN;
- sharing is link-based and unlisted, not private or access-controlled.

Do not use this path to imply that a catalog is official, private, protected, or
reviewed by LumaForge.

## Maintainer flow

```bash
pnpm install

mkdir -p profiles/lut.your-name.manual-warm.v1/assets
cp /path/to/manual-warm.cube profiles/lut.your-name.manual-warm.v1/assets/manual-warm.cube
cp examples/manifests/first-party-lut.manifest.json profiles/lut.your-name.manual-warm.v1/manifest.json

pnpm profiles:refresh-assets --lut-only

pnpm profiles:validate --lut-only --release

pnpm profiles:build-r2 \
  --lut-only \
  --tag v2026.05.04 \
  --public-base-url https://profiles.example.com \
  --channel stable

pnpm profiles:publish-r2:dry-run --tag v2026.05.04 --channel stable
pnpm profiles:publish-r2 --tag v2026.05.04 --channel stable
```

Edit the copied manifest before refreshing:

- set `id` to a stable identifier such as `org.your-name.lut.manual-warm`;
- keep `kind: "lut"` and `format: "cube"`;
- set `title`, `license`, `author`, `source`, `sourceUrl`, and
  `redistributionAllowed`;
- point `assets[0].path` at the copied `.cube` file;
- write the LUT contract under `lut` from maintainer-reviewed knowledge, not
  filename guesses.

During initial hand editing, `assets[].byteSize` and `assets[].sha256` may be
temporary placeholders. Run `profiles:refresh-assets` before validation to
replace them with the actual file size and SHA-256.

`profiles:refresh-assets` only refreshes `assets[].byteSize`,
`assets[].sha256`, and `updatedAt` from files already referenced by existing
manifests. It does not create profile entries, rename directories, infer LUT
contracts, or import loose files. `--lut-only` on refresh, validation, and R2
build fails if any manifest in the registry is not a LUT, so a fork cannot
accidentally publish camera or lens profile entries through the LUT-only
release path.

## R2/S3 publication model

Use the existing R2/S3 release model as the primary distribution path:

```text
blobs/sha256/<aa>/<bb>/<sha256>.cube
releases/<tag>/catalog.json
releases/<tag>/entries/<entry-id>.json
releases/<tag>/release.json
channels/stable/catalog.json
channels/stable/release.json
```

Share either a channel catalog URL for rolling updates:

```text
https://profiles.example.com/channels/stable/catalog.json
```

or a pinned release catalog URL for reproducible snapshots:

```text
https://profiles.example.com/releases/v2026.05.04/catalog.json
```

Channel URLs are convenient for a small maintained LUT set. Pinned release URLs
are better when a recipient needs exactly the same catalog over time.

## Review rules

Before publishing, manually review every maintained `profiles/*/manifest.json`:

- `license` must allow redistribution by the fork maintainer;
- `author`, `source`, and `sourceUrl` should be auditable;
- `redistributionAllowed` must only be true when redistribution is actually
  permitted;
- `assets[].path` should point to the curated local asset path; let
  `profiles:refresh-assets` maintain `byteSize` and `sha256`;
- `lut.inputTransfer`, `lut.inputGamut`, `lut.outputTransfer`, and
  `lut.outputGamut` must be complete when a LUT contract is declared;
- unresolved LUT contracts should stay local until the maintainer can verify
  the intended input and output color handling.

Downloaded or personally shared LUT files are not safe to publish merely
because they are available on the internet. Public link distribution is still
redistribution.

## Non-goals

- No LumaForge-hosted third-party LUT directory.
- No GitHub Release or GitHub Pages first-class workflow for this mode.
- No authentication, access control, invite list, or token gate.
- No promise that LumaForge App will expose this catalog to ordinary users.
