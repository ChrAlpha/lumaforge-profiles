# lumaforge-profiles

LumaForge Profiles is a multi-license registry for LUTs, camera profiles, lens
correction profiles, calibration data, and related profile metadata.

The repository does not use a single license for every file:

- Source code, scripts, validation tools, and build utilities authored by
  LumaForge use MIT.
- Schemas, manifests, index files, and documentation authored by LumaForge use
  CC0-1.0.
- First-party profile assets should default to CC0-1.0.
- Third-party profile assets keep their original license and must declare
  source, author, license, and redistribution permission per asset.

Assets without a clear source, author, license, and redistribution permission
are not accepted.

See [LICENSE.md](LICENSE.md), [COPYRIGHT_POLICY.md](COPYRIGHT_POLICY.md), and
[CONTRIBUTING.md](CONTRIBUTING.md) before adding any profile asset.

## Repository Layout

```text
LICENSE.md                      Multi-license policy
LICENSES/                       Bundled license texts
COPYRIGHT_POLICY.md             Asset acceptance and provenance policy
CONTRIBUTING.md                 Contributor certification and PR checklist
NOTICE.md                       Repository-level notice index
schemas/profile-manifest.schema.json
examples/manifests/             Example first-party and third-party manifests
profiles/                       Future profile asset directories
```

Every asset under `profiles/` must include its own `manifest.json`. Add
resource-local `LICENSE` and `NOTICE.md` files whenever the asset license,
attribution terms, provenance, or modification history require them.
