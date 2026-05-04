# 贡献指南

语言: [English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING.zh-CN.md)

LumaForge Profiles 是一个多许可证 registry。贡献必须明确说明每个资产的版权、来源、许可证和再分发状态。

## 必需模型

Entry 位于平铺目录下：

```text
profiles/
  lut.lumaforge.neutral-rec709.v1/
    manifest.json
    assets/
      neutral-rec709.cube
    LICENSE
    NOTICE.md
```

不要添加基于分类目录的 loader 假设，例如 `profiles/luts`、`profiles/cameras` 或 `profiles/lenses`。工具和 consumer 必须使用 `profiles/*/manifest.json`，或 `lumaforge-profiles.json` 中的显式 entries。

`profiles/*/assets/` 下的资产文件有意被 git 忽略。提交 manifest、schema 变更、license 文件、notice 文件、文档和工具；不要提交大型 `.cube`、`.dcp` 或 `.lcp` 资产。

## 资产认证

贡献 profile asset 或 manifest，即表示你确认：

1. 该资产由你自行创建，或你有权提交它。
2. 该资产可以通过本仓库和公开 R2/CDN 分发路径再分发。
3. Manifest 中的许可证信息准确。
4. Manifest 的 author 和 source 字段清晰标识来源。
5. 已包含必需 attribution、修改说明和许可证文件。

## 禁止来源

不要提交从 Adobe、Lightroom、Camera Raw、Photoshop、DaVinci Resolve、Capture One、DxO、相机 vendor 软件、商业 LUT 包、付费下载、trial-only package、固件 bundle、SDK package 或 personal-use-only 下载中复制的资源，除非其许可证明确允许通过本 registry 再分发。

不接受无许可证、专有、仅限个人使用、不可再分发或条款不清楚的资产。

## Manifest 要求

每个 entry 至少必须包含带以下字段的 `manifest.json`：

- `id`
- `kind`
- `format`
- `version`
- `title`
- `license`
- `author`
- `source`
- `sourceUrl`
- `redistributionAllowed`
- `targets`
- `assets[].role`
- `assets[].path`
- `assets[].mediaType`
- `assets[].byteSize`
- `assets[].sha256`

第一方资产通常应使用：

```json
{
  "license": "CC0-1.0",
  "author": "LumaForge contributors",
  "source": "original",
  "redistributionAllowed": true
}
```

没有明确权利的本地导入默认使用：

```json
{
  "license": "NOASSERTION",
  "author": "Unknown",
  "source": "local-import",
  "redistributionAllowed": false
}
```

这可用于本地整理文件，但不适用于 release。

## 验证和 Release Gate

运行：

```bash
pnpm profiles:validate
pnpm profiles:validate --release
```

Release gate 会在以下情况下拒绝 entry：

- `redistributionAllowed` 不是 `true`
- `license` 缺失、为 `NOASSERTION` 或为 `UNLICENSED`
- `author` 缺失
- 任一资产缺失
- 任一资产缺失 `sha256`
- 任一资产 hash 或 byte size 与 manifest 不一致
- 任一资产路径逃逸其 entry 目录
- 受支持 profile format 没有且只有一个 primary runtime asset

`pnpm profiles:build-s3 --tag <tag> --public-base-url <url>` 会在创建 `catalog.json`、`entries/*.json`、`release.json`、`blobs-manifest.json`、`publish-plan.json` 和 `checksums.txt` 之前运行 release gate。使用 `pnpm profiles:publish-s3:dry-run --tag <tag> --channel stable` 检查上传，使用 `pnpm profiles:publish-s3 --tag <tag> --channel stable` 执行上传。

## Pull Request Checklist

- Entry 具有平铺的 `profiles/<entry-dir>/manifest.json`。
- Manifest 声明了清晰的 source、author、license 和再分发许可。
- 许可证允许通过本仓库再分发。
- `NOTICE.md` 包含必需 attribution。
- `LICENSE` 或 `LICENSES/` 包含必需 license text。
- 没有大型 profile asset 被提交到 Git 历史。
- `pnpm test` 通过。
- `pnpm profiles:validate --release` 对可发布 entry 通过。
- `pnpm profiles:build-s3 --tag <tag> --public-base-url <url>` 生成预期的 `dist/s3-release/<tag>/` artifact set。
