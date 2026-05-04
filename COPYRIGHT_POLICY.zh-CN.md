# 版权政策

语言: [English](COPYRIGHT_POLICY.md) | [简体中文](COPYRIGHT_POLICY.zh-CN.md)

LumaForge Profiles 只接受本仓库可以在明确条款下再分发的资产。

本政策是面向贡献者和维护者的项目指引，不构成法律建议。

## 默认模型

- 第一方 profile asset 默认以 CC0-1.0 贡献，除非其 manifest 另有声明。
- 仓库工具使用 MIT 许可证。
- LumaForge 编写的文档、schema、manifest 和 index data 以 CC0-1.0 贡献。
- 第三方资产保留其原始许可证，并且必须包含明确的再分发许可。
- 不接受无许可证、专有、仅限个人使用、不可再分发或条款不清楚的资产。

## 必需来源证明

每个 profile asset 必须包含 `manifest.json`，至少包括：

- `id`
- `kind`
- `title`
- `license`
- `author`
- `source`
- `redistributionAllowed`
- `derivativeOf`
- `copyright`

第三方资产还必须包含足够信息，使维护者和下游用户能够审计来源，例如 source URL、可用时的 source commit 或 release、必需 attribution，以及修改说明。

## 禁止来源

不要提交复制或提取自以下来源的资产：

- 商业 LUT 包；
- 付费、捆绑或 trial-only 创意软件；
- DaVinci Resolve、Lightroom、Camera Raw、Capture One、DxO、Photoshop 或类似软件包，除非 vendor license 明确允许再分发；
- 相机 vendor 软件、SDK、ICC/DCP/profile 包或固件，除非 vendor license 明确允许再分发；
- 没有提供清晰许可证和再分发授权的 YouTube 描述、论坛帖子、文件分享链接或个人网站；
- 条款写明仅限个人使用、禁止再分发、禁止转售或禁止修改的免费下载。

## LUT

可接受的 LUT 必须是第一方、public-domain、CC0、CC-BY、MIT-compatible，或以其他方式明确允许再分发。可下载的 LUT 不会因为能下载就可接受；其许可证必须允许在本仓库中再分发。

## Camera Profiles

Camera profile 需要额外审查。Adobe DCP profile、相机 vendor profile，以及从专有 RAW processor 中提取的 profile，除非其许可证清楚允许再分发，否则不得提交。

更安全的提交包括基于公开测试 target、原始测量或可复现 recipe 生成的第一方 profile。当原始 profile 无法再分发时，只提交元数据和生成 recipe。

## Lens Correction Data

从 Lensfun、darktable 或 RawTherapee 等项目导入的 lens correction data，必须保留原始许可证、author、source URL、source commit、attribution 要求和修改历史。

Share-alike 或 reciprocal license obligation 必须隔离在资源自己的目录中，并在其 manifest 和 NOTICE 文件中明确说明。

## 审查规则

不确定时，不要合并资产。要求更清楚的来源证明、更具体的许可证授权，或第一方再生成路径。
