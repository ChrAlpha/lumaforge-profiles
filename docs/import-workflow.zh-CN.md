# 导入工作流

语言: [English](import-workflow.md) | [简体中文](import-workflow.zh-CN.md)

本文档覆盖自动化导入路径。它适用于批量本地暂存、已审查的 vendor 包，以及 ACEScct/AP1 迁移实验。它不是偏好手工维护 `profiles/*/manifest.json` 的维护者的主要路径；该流程请见 [LUT-only S3 自托管](lut-only-s3-self-hosting.zh-CN.md)。

## 导入并平铺

安装依赖：

```bash
pnpm install
```

推荐导入工作流：

```bash
# 1. 将本地资源放入被忽略的投放区
mkdir -p .local-profile-imports

# 2. 导入并平铺为 profile entries
pnpm profiles:import \
  --from .local-profile-imports \
  --namespace lumaforge \
  --author "LumaForge contributors" \
  --license CC0-1.0 \
  --redistribution-allowed \
  --migrate-luts-to-acescct-ap1

# 3. 验证 manifest 和本地资产
pnpm profiles:validate

# 4. 重新生成 repository index
pnpm profiles:index

# 5. 构建 S3/CDN release artifacts
pnpm profiles:build-s3 --tag v2026.04.29 --public-base-url https://profiles.lumaforge.invalid --channel stable

# 6. 对 S3 publish plan 进行 dry-run
pnpm profiles:publish-s3:dry-run --tag v2026.04.29 --channel stable

# 7. 发布不可变 blob 和 channel alias
pnpm profiles:publish-s3 --tag v2026.04.29 --channel stable

# 8. 检查或执行垃圾回收
pnpm profiles:s3:gc --keep-releases 3 --dry-run
```

`import` 命令会递归扫描 `.cube`、`.dcp`、`.icc`、`.lcp` 和基于 JSON 的 profile 文件，将它们复制到 `profiles/<entry-dir>/assets/`，并写入或更新每个 `manifest.json`。默认情况下，现有 manifest 会保留精选元数据，而资产哈希、大小和路径元数据会被刷新。

如果导入时省略 license、author 或 redistribution 标志，工具会写入保守的 local-only 默认值：

```json
{
  "license": "NOASSERTION",
  "author": "Unknown",
  "source": "local-import",
  "redistributionAllowed": false
}
```

这些 entry 可用于本地组织，但不能作为 release asset 发布。

## LUT contracts

对于 LUT，导入会把解析出的 `.cube` 表格元数据记录在 `lut` 下。Camera-log LUT 应携带显式 render contract：

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

不同输入曲线的 camera-log LUT 是不同 contract，而不是重复资产。Importer 会为当前 `.local-profile-imports/` 下已审查的本地 vendor 包使用精选 source-package rule：`arri`、`autel-robotics`、`dji`、`filmic-pro`、`fujifilm`、`insta360`、`leica`、`nikon`、`om-system`、`panasonic`、`red` 和 `sony`。规则可以添加输入/输出 contract，并在 entry slug 上附加可读 contract 后缀，避免同名 look 合并成仅靠 hash 区分的冲突。

`.cube` parser 有意不把自由格式注释当作可信 contract 元数据。如果没有 source-package rule 命中，导入的 LUT 会保持 unresolved，直到维护者编辑 manifest 或添加新的已审查 source rule。Kinefinity 目前也留在 unresolved bucket：`.cube` 资产可以暂存，但 `.look` sidecar 会被忽略，且尚未应用已审查 contract rule。GoPro 也仍在已审查规则集之外，直到稳定的官方包被本地镜像，并且 contract 可以被审查。维护者在将 entry 标记为可再分发之前，仍应审查 vendor 条款和 contract 元数据。

## ACEScct/AP1 迁移

启用 `--migrate-luts-to-acescct-ap1` 时，具有完整已审查输入/输出 contract 的受支持导入 `.cube` LUT 会被烘焙为规范的 ACES AP1 / ACEScct `65^3` 资产。生成的 manifest 会将 LUT 输入 contract 改为 `inputGamut: "aces-ap1"` 和 `inputTransfer: "acescct"`，将源 LUT 输出烘焙到 `outputGamut: "rec709"` 和 `outputTransfer: "srgb"`，并把源输入/输出 contract 记录到 `source*` 元数据字段下。缺少完整可信 contract、transfer/gamut 不受支持或 cube 数据无效的 LUT 会保留为普通导入，并由 CLI 报告为 skipped。该迁移不会改变许可证或再分发标志；条款不清楚的第三方资产仍保持 local-only。
