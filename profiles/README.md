# Profiles

Each profile asset must live in a dedicated directory with its own manifest and
any required license or notice files.

Recommended layout:

```text
profiles/
  luts/
    <asset-id>/
      <asset files>
      manifest.json
      LICENSE
      NOTICE.md
  camera-profiles/
    <asset-id>/
      <asset files>
      manifest.json
      LICENSE
      NOTICE.md
  lens-profiles/
    <asset-id>/
      <asset files>
      manifest.json
      LICENSE
      NOTICE.md
```

The manifest is mandatory. `LICENSE` and `NOTICE.md` are mandatory whenever the
asset license, attribution terms, provenance, or modification history require
them.

First-party LumaForge assets should default to CC0-1.0. Third-party assets must
retain their original license and redistribution terms.
