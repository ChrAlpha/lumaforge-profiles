# lumaforge-profiles

语言: [English](README.md) | [简体中文](README.zh-CN.md)

用于维护和发布 LumaForge RAW 流水线小型 LUT 目录的 manifest-first 工具。

常见用法是由个人或小团队维护一个 fork：保存一组精选 `.cube` LUT，将它们发布到自己的 S3 兼容 bucket，并自行分享公开的 catalog URL。LumaForge 不会认证、审查、运营或背书第三方 fork。

## 快速开始

```bash
pnpm install

mkdir -p profiles/lut.your-name.manual-warm.v1/assets
cp /path/to/manual-warm.cube profiles/lut.your-name.manual-warm.v1/assets/manual-warm.cube
cp examples/manifests/first-party-lut.manifest.json profiles/lut.your-name.manual-warm.v1/manifest.json
```

编辑 `profiles/lut.your-name.manual-warm.v1/manifest.json`：

- 设置 `id`、`title`、`license`、`author`、`source` 和 `sourceUrl`；
- 保持 `kind: "lut"` 和 `format: "cube"`；
- 让 `assets[0].path` 指向你的 `.cube` 文件；
- 根据已经审查过的知识在 `lut` 下写入 LUT contract，不要依赖文件名猜测；
- 只有在你确实有权再分发该 LUT 时，才设置 `redistributionAllowed`。

然后刷新生成的资产元数据并发布：

```bash
pnpm profiles:refresh-assets --lut-only
pnpm profiles:validate --lut-only --release
pnpm profiles:build-s3 --lut-only --tag v2026.05.04 --public-base-url https://profiles.example.com --channel stable
pnpm profiles:publish-s3:dry-run --tag v2026.05.04 --channel stable
pnpm profiles:publish-s3 --tag v2026.05.04 --channel stable
```

分享以下任一公开 URL：

```text
https://profiles.example.com/channels/stable/catalog.json
https://profiles.example.com/releases/v2026.05.04/catalog.json
```

Channel URL 会接收未来更新。Release URL 是固定快照。

## 仓库结构

Profile entry 被平铺在 `profiles/*/manifest.json` 下：

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

路径只用于存储。语义由 manifest 拥有，包括 `kind`、`format`、license、source、author、再分发许可、资产哈希、媒体类型以及 LUT 输入/输出 contract。Loader 应读取 `lumaforge-profiles.json` 或扫描 `profiles/*/manifest.json`；不应依赖 `profiles/luts` 这类分类目录。

`profiles/*/assets/` 下的资产会被 git 忽略。它们可以存在于本地用于验证和构建 release，但不应提交。

## 维护者命令

```bash
pnpm profiles:refresh-assets --lut-only
pnpm profiles:validate --lut-only --release
pnpm profiles:index
pnpm profiles:build-s3 --lut-only --tag <tag> --public-base-url <url> --channel stable
pnpm profiles:publish-s3:dry-run --tag <tag> --channel stable
pnpm profiles:publish-s3 --tag <tag> --channel stable
pnpm profiles:s3:gc --keep-releases 3 --dry-run
```

`profiles:refresh-assets` 只会更新现有 manifest 的 `assets[].byteSize`、`assets[].sha256` 和 `updatedAt`。它不会创建 entry、导入散落文件、重命名目录或推断 LUT contract。

`--lut-only` 会在存在非 LUT manifest 时 fail closed。LUT-only fork 应使用它，避免 camera 或 lens profile entry 意外进入共享 catalog。

发布会从 `.env` 或 shell 读取通用 `S3_*` 变量：`S3_BUCKET`、`S3_ENDPOINT`、`S3_REGION`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_PUBLIC_BASE_URL`，以及可选的 `S3_FORCE_PATH_STYLE`。

## 分发模型

S3 兼容发布器会写入：

```text
blobs/sha256/<aa>/<bb>/<sha256>.cube
releases/<tag>/catalog.json
releases/<tag>/entries/<entry-id>.json
releases/<tag>/release.json
releases/<tag>/blobs-manifest.json
channels/stable/catalog.json
channels/stable/release.json
```

Blob URL 是不可变、按内容寻址的。Channel 文件是可变的，并且最后更新，因此 channel 不会指向一个只上传了一半的 release。

Release 验证会对不清楚的再分发条款、缺失 author、缺失资产、缺失哈希、字节大小不匹配和哈希不匹配 fail closed。

## 重要边界

- 共享 catalog URL 对任何拥有或收到该链接的人都是公开的。
- 本仓库不提供认证或访问控制。
- 下载来的 LUT 并不因为能在网上获得就可以安全发布；必须有允许再分发的许可证。
- 第三方资产保留其原始许可证，并且必须包含清晰的来源证明。
- 未解析的 LUT contract 应保持本地状态，直到维护者验证预期的输入和输出色彩处理。

## 更多文档

- [LUT-only S3 自托管](docs/lut-only-s3-self-hosting.zh-CN.md)
- [Cloudflare R2 设置](docs/cloudflare-r2-setup.zh-CN.md)
- [自动导入工作流](docs/import-workflow.zh-CN.md)
- [官方 LUT 来源清单](docs/official-lut-source-inventory.zh-CN.md)
- [版权政策](COPYRIGHT_POLICY.zh-CN.md)
- [贡献指南](CONTRIBUTING.zh-CN.md)

## 兼容性

第三方 registry 即使不使用本工具也可以兼容。它们只需要提供以下任一内容：

- 一个包含显式 entry 路径的顶层 `lumaforge-profiles.json`；或
- loader 可扫描的平铺 `profiles/*/manifest.json` entry。

Manifest schema 是兼容性 contract。
