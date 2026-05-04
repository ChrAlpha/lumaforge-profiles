# Cloudflare R2 设置

语言: [English](cloudflare-r2-setup.md) | [简体中文](cloudflare-r2-setup.zh-CN.md)

本仓库负责生成 manifest、schema、工具和 release 工作流；但一旦 S3 兼容对象存储成为分发源，已发布的 profile registry 也会通过 bucket 本身维护。不可变 profile blob、带版本的 release index，以及可变 channel pointer 会写入 Cloudflare R2，然后通过 Cloudflare 前置的自定义域名 CDN 提供服务。

## 必需的 Cloudflare 资源

1. 创建一个用于 profile 分发的 R2 bucket。
2. 创建作用域限制在该 bucket、具备对象读写权限的 R2 API token。
3. 将 `profiles.lumaforge.invalid` 这类自定义域名绑定到 bucket。
4. 让自定义域名保持 Cloudflare 代理状态，以便启用边缘缓存。

## 推荐 bucket 布局

发布器会在以下前缀下写入对象：

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

## 环境变量

复制 `.env.example` 并设置：

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

R2 与其他 S3 兼容 provider 一样，通过相同的 `S3_*` 变量配置。Cloudflare R2 应设置 `S3_REGION=auto`。

## 公开访问和缓存行为

- 生产流量应通过自定义域名提供服务，不要使用 `r2.dev`。
- 允许对已发布对象进行匿名 `GET`/`HEAD` 读取。
- 为 `profiles.lumaforge.invalid/*` 添加 Cache Rule，或者至少覆盖 `blobs/*`、`releases/*` 和 `channels/*`，并缓存所有文件类型，因为 `.cube`、`.dcp`、`.lcp` 等 profile 扩展名不是默认缓存扩展名。
- Blob 对象应使用长缓存头保持不可变。
- 带 tag 的 release JSON 应保持不可变，但使用较短的静态 TTL。
- Channel alias JSON 应短缓存，以便 `stable` / `latest` 可以向前滚动。

发布器会设置：

```text
blobs/*                   -> Cache-Control: public, max-age=31536000, immutable
releases/<tag>/*.json     -> Cache-Control: public, max-age=86400, immutable
channels/<name>/*.json    -> Cache-Control: public, max-age=60, stale-while-revalidate=600
```

## CORS

如果浏览器客户端会直接获取 profile 资产，需要配置 bucket CORS，允许 app origin 以及 `GET`、`HEAD` 和 `OPTIONS`。

推荐基线：

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

如果 runtime 需要额外响应头，请先将它们加入 `ExposeHeaders`，再在浏览器代码中依赖这些头。

## 发布流程

```bash
pnpm profiles:validate --release
pnpm profiles:build-s3 --tag v2026.04.29 --public-base-url https://profiles.lumaforge.invalid --channel stable
pnpm profiles:publish-s3:dry-run --tag v2026.04.29 --channel stable
pnpm profiles:publish-s3 --tag v2026.04.29 --channel stable
```

上传顺序如下：

1. 新的不可变 blob
2. `releases/<tag>/entries/*.json`
3. `releases/<tag>/catalog.json`
4. `releases/<tag>/release.json`
5. `releases/<tag>/blobs-manifest.json`
6. `channels/<name>/catalog.json`
7. `channels/<name>/release.json`

这样 channel alias 不会指向只上传了一半的 release。

## GC

先使用 dry-run：

```bash
pnpm profiles:s3:gc --keep-releases 3 --dry-run
```

再显式执行：

```bash
pnpm profiles:s3:gc --keep-releases 3 --yes
```

GC 会保留：

- 受保护 channel 引用的任何 release
- 通过 `--keep-tags` 显式列出的任何 tag
- 按 `release.json.createdAt` 排序最新的 `--keep-releases` 个 tag

GC 会删除：

- 未被保留的旧 `releases/<tag>/...` 对象
- 不再被任何保留的 `blobs-manifest.json` 引用的 blob
