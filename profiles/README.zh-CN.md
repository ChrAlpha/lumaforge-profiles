# Profiles

语言: [English](README.md) | [简体中文](README.zh-CN.md)

每个 profile entry 都位于 `profiles/` 下的一个平铺目录中。

```text
profiles/
  lut.lumaforge.neutral-rec709.v1/
    manifest.json
    assets/
      neutral-rec709.cube
    LICENSE
    NOTICE.md
```

目录名只用于存储。语义属于 `manifest.json`。Loader 应使用 `profiles/*/manifest.json`，或顶层 `lumaforge-profiles.json` 中的显式 entries。

`assets/` 内容会被 git 忽略，并通过 Cloudflare R2 content-addressed blobs 和带版本的 release catalogs 分发。保持 `manifest.json`、`LICENSE` 和 `NOTICE.md` 可被跟踪。
