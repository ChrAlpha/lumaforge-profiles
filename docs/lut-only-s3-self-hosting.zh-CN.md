# LUT-only S3 自托管

语言: [English](lut-only-s3-self-hosting.md) | [简体中文](lut-only-s3-self-hosting.zh-CN.md)

这个工作流面向 fork 本仓库的维护者：维护自己的小型 LUT 集合，将其发布到自己的 S3 兼容 bucket，并自行分享生成的公开 catalog 或 channel URL。

它不是官方 LumaForge LUT channel。LumaForge 不会认证、背书、审查或运营第三方 fork。如果某个 catalog URL 可以访问，那么任何拥有或收到该链接的人都可以公开访问它。

## 范围

在以下情况下使用这个路径：

- fork 只打算分发 `.cube` LUT entry；
- 维护者愿意自行审查 LUT contract 和许可证；
- 分发通过维护者自己的 S3 兼容 bucket 和公开 CDN 完成；
- 分享基于链接且未公开列出，而不是私有或带访问控制的分享。

不要用这个路径暗示某个 catalog 是官方的、私有的、受保护的，或已经由 LumaForge 审查。

## 维护者流程

```bash
pnpm install

mkdir -p profiles/lut.your-name.manual-warm.v1/assets
cp /path/to/manual-warm.cube profiles/lut.your-name.manual-warm.v1/assets/manual-warm.cube
cp examples/manifests/first-party-lut.manifest.json profiles/lut.your-name.manual-warm.v1/manifest.json

pnpm profiles:refresh-assets --lut-only

pnpm profiles:validate --lut-only --release

pnpm profiles:build-s3 \
  --lut-only \
  --tag v2026.05.04 \
  --public-base-url https://profiles.example.com \
  --channel stable

pnpm profiles:publish-s3:dry-run --tag v2026.05.04 --channel stable
pnpm profiles:publish-s3 --tag v2026.05.04 --channel stable
```

刷新前先编辑复制出来的 manifest：

- 将 `id` 设置为稳定标识，例如 `org.your-name.lut.manual-warm`；
- 保持 `kind: "lut"` 和 `format: "cube"`；
- 设置 `title`、`license`、`author`、`source`、`sourceUrl` 和 `redistributionAllowed`；
- 让 `assets[0].path` 指向复制后的 `.cube` 文件；
- 根据维护者已审查过的知识在 `lut` 下写入 LUT contract，不要依赖文件名猜测。

初次手动编辑时，`assets[].byteSize` 和 `assets[].sha256` 可以临时占位。验证前运行 `profiles:refresh-assets`，用实际文件大小和 SHA-256 替换它们。

`profiles:refresh-assets` 只会从现有 manifest 已引用的文件刷新 `assets[].byteSize`、`assets[].sha256` 和 `updatedAt`。它不会创建 profile entry、重命名目录、推断 LUT contract 或导入散落文件。在 refresh、validation 和 S3 build 中使用 `--lut-only` 时，只要 registry 中任一 manifest 不是 LUT 就会失败，因此 fork 不会通过 LUT-only release path 意外发布 camera 或 lens profile entry。

## S3 发布模型

主要分发路径应使用 S3 兼容 release model：

```text
blobs/sha256/<aa>/<bb>/<sha256>.cube
releases/<tag>/catalog.json
releases/<tag>/entries/<entry-id>.json
releases/<tag>/release.json
channels/stable/catalog.json
channels/stable/release.json
```

分享 channel catalog URL 可获得滚动更新：

```text
https://profiles.example.com/channels/stable/catalog.json
```

或者分享固定 release catalog URL 以获得可复现快照：

```text
https://profiles.example.com/releases/v2026.05.04/catalog.json
```

对于小型维护中的 LUT 集合，Channel URL 更方便。若接收方需要长期使用完全相同的 catalog，则固定 release URL 更合适。

## 审查规则

发布前，手动审查每个维护中的 `profiles/*/manifest.json`：

- `license` 必须允许 fork 维护者再分发；
- `author`、`source` 和 `sourceUrl` 应可审计；
- 只有在确实允许再分发时，`redistributionAllowed` 才能为 true；
- `assets[].path` 应指向精选后的本地资产路径；让 `profiles:refresh-assets` 维护 `byteSize` 和 `sha256`；
- 声明 LUT contract 时，`lut.inputTransfer`、`lut.inputGamut`、`lut.outputTransfer` 和 `lut.outputGamut` 必须完整；
- 未解析的 LUT contract 应保持本地状态，直到维护者能够验证预期的输入和输出色彩处理。

下载或他人私下分享的 LUT 文件，并不因为能在互联网上获得就可以安全发布。公开链接分发仍然是再分发。

## 非目标

- 不提供由 LumaForge 托管的第三方 LUT 目录。
- 此模式不把 GitHub Release 或 GitHub Pages 作为一等工作流。
- 不提供认证、访问控制、邀请列表或 token gate。
- 不承诺 LumaForge App 会向普通用户暴露这个 catalog。
