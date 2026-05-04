# Cloudflare R2 Setup

Languages: [English](cloudflare-r2-setup.md) | [简体中文](cloudflare-r2-setup.zh-CN.md)

This repository authors manifests, schemas, tooling, and release workflows, but
once S3-compatible object storage is the distribution source, the published
profile registry is also maintained through the bucket itself. Immutable profile
blobs, versioned release indexes, and mutable channel pointers are written to
Cloudflare R2 and then served through a custom-domain CDN fronted by Cloudflare.

## Required Cloudflare resources

1. Create an R2 bucket for profile distribution.
2. Create an R2 API token scoped to that bucket with object read/write access.
3. Attach a custom domain such as `profiles.lumaforge.invalid` to the bucket.
4. Keep the custom domain proxied through Cloudflare so edge caching applies.

## Recommended bucket layout

The publisher writes objects under these prefixes:

```text
blobs/sha256/<aa>/<bb>/<full-sha256>.<ext>
releases/<tag>/catalog.json
releases/<tag>/entries/<entry-id>.json
releases/<tag>/release.json
releases/<tag>/blobs-manifest.json
channels/stable/catalog.json
channels/stable/release.json
channels/latest/catalog.json
channels/latest/release.json
```

## Environment variables

Copy `.env.example` and set:

```text
S3_BUCKET=
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=https://profiles.lumaforge.invalid
S3_FORCE_PATH_STYLE=false
LUMAFORGE_PROFILES_CHANNEL=stable
```

R2 is configured through the same `S3_*` variables as every other
S3-compatible provider. Set `S3_REGION=auto` for Cloudflare R2.

## Public access and cache behavior

- Serve production traffic through the custom domain, not `r2.dev`.
- Allow anonymous `GET`/`HEAD` reads for published objects.
- Add a Cache Rule for `profiles.lumaforge.invalid/*` or at least `blobs/*`,
  `releases/*`, and `channels/*` that caches all file types, since `.cube`,
  `.dcp`, `.lcp`, and similar profile extensions are not default cache
  extensions.
- Keep blob objects immutable with long-lived cache headers.
- Keep tagged release JSON immutable with a shorter static TTL.
- Keep channel alias JSON short-lived so `stable` / `latest` can roll forward.

The publisher sets:

```text
blobs/*                   -> Cache-Control: public, max-age=31536000, immutable
releases/<tag>/*.json     -> Cache-Control: public, max-age=86400, immutable
channels/<name>/*.json    -> Cache-Control: public, max-age=60, stale-while-revalidate=600
```

## CORS

If browser clients fetch profile assets directly, configure bucket CORS to allow
the app origin(s) and `GET`, `HEAD`, and `OPTIONS`.

Recommended baseline:

```json
[
  {
    "AllowedOrigins": ["https://app.lumaforge.invalid", "http://localhost:3000"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": [
      "Content-Length",
      "Content-Type",
      "ETag",
      "Cache-Control"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

If the runtime needs additional response headers, add them to `ExposeHeaders`
before relying on them in browser code.

## Publish flow

```bash
pnpm profiles:validate --release
pnpm profiles:build-s3 --tag v2026.04.29 --public-base-url https://profiles.lumaforge.invalid --channel stable
pnpm profiles:publish-s3:dry-run --tag v2026.04.29 --channel stable
pnpm profiles:publish-s3 --tag v2026.04.29 --channel stable
```

Uploads happen in this order:

1. New immutable blobs
2. `releases/<tag>/entries/*.json`
3. `releases/<tag>/catalog.json`
4. `releases/<tag>/release.json`
5. `releases/<tag>/blobs-manifest.json`
6. `channels/<name>/catalog.json`
7. `channels/<name>/release.json`

That keeps channel aliases from pointing at a half-uploaded release.

## GC

Use dry-run first:

```bash
pnpm profiles:s3:gc --keep-releases 3 --dry-run
```

Then execute explicitly:

```bash
pnpm profiles:s3:gc --keep-releases 3 --yes
```

GC keeps:

- any release referenced by protected channels
- any explicitly listed `--keep-tags`
- the newest `--keep-releases` tags by `release.json.createdAt`

GC removes:

- old `releases/<tag>/...` objects not kept
- blobs no longer referenced by any kept `blobs-manifest.json`
