# Profiles

Each profile entry lives in one flattened directory under `profiles/`.

```text
profiles/
  lut.lumaforge.neutral-rec709.v1/
    manifest.json
    assets/
      neutral-rec709.cube
    LICENSE
    NOTICE.md
```

The directory name is only storage. Semantics belong in `manifest.json`.
Loaders should use `profiles/*/manifest.json` or the explicit entries in the
top-level `lumaforge-profiles.json`.

`assets/` contents are git ignored and are distributed through GitHub Release
packs. Keep `manifest.json`, `LICENSE`, and `NOTICE.md` trackable.
