# Official LUT Source Inventory

Research dates: 2026-04-28; Fujifilm supplement: 2026-04-29

This is a source inventory only. Do not commit, pack, or publish third-party LUT
assets from these sources unless the vendor terms explicitly allow
redistribution by this repository. Public download access is not enough for a
release pack.

Use this collection as crawl seeds for local review, manifest drafting, and
license triage. Until a license is checked, imported assets should remain
local-only with `redistributionAllowed: false`.

## Collection Classes

| Class | Meaning | Default repo action |
| --- | --- | --- |
| `official-download` | Vendor publishes a public LUT package or download page. | Link and inspect locally; do not redistribute until terms are clear. |
| `official-generator` | Vendor publishes a tool or documented transform that can bake LUTs. | Prefer recording recipe/source metadata; generated LUTs still need license review. |
| `bundled-or-account` | LUT exists in vendor software, device firmware, or a sign-in gated download. | Keep link-only metadata unless redistribution permission is explicit. |
| `standards-source` | Open standard, CTL, CLF, OCIO config, or equivalent transform source. | Preserve upstream license and generation recipe. |
| `candidate` | Mentioned by vendor or community but not yet proven as a stable official asset source. | Verify before manifest work. |

## Camera Vendor Sources

| Priority | Vendor | Class | Official source | Candidate transforms and looks | Profile notes | Legal default |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | ARRI | `official-download`, `official-generator` | [ARRI LUT Generator](https://www.arri.com/en/learn-help/learn-help-camera-system/tools/lut-generator/43892-43892), [ARRI LUT naming convention PDF](https://www.arri.com/resource/blob/294602/99cf69084be7f6638181660483d3e39d/arri-lut-naming-convention-logc4-and-logc3-guideline-en-data.pdf) | LogC3 and LogC4 to Rec.709, P3, Rec.2020, PQ, HLG; ARRI Look Library | LogC3 and LogC4 are separate contracts. Store input gamut/transfer and output target explicitly. | Link-only until ARRI package terms are reviewed. |
| P0 | RED | `official-download`, `official-generator` | [IPP2 Overview](https://support.red.com/hc/en-us/articles/115004913827-IPP2-Overview), [IPP2 Output Presets](https://www.red.com/download/ipp2-output-presets), [IPP2 LUT Creator docs](https://docs.red.com/955-0004/REDCINE-XProOperationGuide/Content/6_ExportClips/IPP2_LUT_Creator.htm) | REDWideGamutRGB / Log3G10 IPP2 output transforms to Rec.709, Rec.2020, HDR variants; creative LUTs | IPP2 separates creative LUTs from output transforms. Record tone map and highlight roll-off choices. | Link-only; download requires terms acceptance. |
| P0 | Sony | `official-download` | [Sony LUT information](https://www.sony.com/electronics/support/articles/00258100), [Sony Look Profile 3D LUT downloads](https://www.sony.com/electronics/support/software/00263050), [Sony CineAlta workflow guide](https://pro.sony/s3/2024/11/29133636/Sony_CineAlta_WF_Guide_v1.0.pdf) | S-Gamut/S-Log2, S-Gamut3.Cine/S-Log3, s709, LC-709, LC-709A, VENICE related looks | Keep S-Gamut3 and S-Gamut3.Cine distinct. Many looks are monitoring/output looks rather than neutral transforms. | Link-only until Sony terms are reviewed. |
| P0 | Fujifilm | `official-download` | [FUJIFILM LUT for F-Log / IDT for F-Log](https://www.fujifilm-x.com/en-us/r2/support/download/lut/), [FUJIFILM 3D-LUT by camera model](https://www.fujifilm-x.com/en-us/lut/) | F-Log, F-Log2, and F-Log2 C technical LUTs and IDTs; model-specific F-Log/F-Log2/F-Log2 C to ETERNA, ETERNA Bleach Bypass, WDR-709, and F-Log/F-Log2/F-Log2 C 709 outputs; GFX ETERNA 55 film simulation LUTs including PROVIA, Velvia, ASTIA, Classic Chrome, Classic Neg., Pro Neg. Std, ACROS, REALA ACE, ETERNA, and ETERNA Bleach Bypass | Separate F-Log, F-Log2, and F-Log2 C. Record whether input is F-Gamut or F-Gamut C, the camera model, 33-grid vs 65-grid package, and whether the LUT is a technical output, WDR output, or film simulation look. | Link-only until Fujifilm terms are reviewed. |
| P0 | Canon | `official-download` | [Canon Log 10 to Rec.709 LUT](https://www.cvi.canon.com/nw3s/CanonUSA/DownloadContents/English/0200280202EN.htm), [Canon Log 12 to Rec.709 LUT](https://sg.canon/en/support/0200280302) | Canon Log, Canon Log 2, Canon Log 3, Cinema Gamut to BT.709, Wide DR, BT.2020, DCI-P3, PQ, HLG | Canon has many support-page packages by camera/gamma/bit-depth. Capture exact package id and version. | Link-only until Canon terms are reviewed. |
| P0 | Panasonic / LUMIX / VariCam | `official-download` | [Panasonic V-Log LUT download](https://av.jpn.support.panasonic.com/support/global/cs/dsc/download/lut/), [V-Log/V-Gamut RAW output conversion LUT](https://av.jpn.support.panasonic.com/support/global/cs/dsc/download/lut/s1h_raw_lut/index.html), [LUMIX Lab LUT page](https://panasonic.jp/dc/lumix-lab/lut.html) | V-Log / V-Gamut to V-709; RAW Gamut to V-Log/V-Gamut; LUMIX Lab creator LUTs | Separate technical V-709 transforms from LUMIX Lab creative/user LUTs. Some camera formats use `.vlt`. | Link-only until Panasonic terms are reviewed. |
| P0 | Nikon | `official-download` | [Nikon N-Log LUT Download Center](https://downloadcenter.nikonimglib.com/en/products/520/N-Log_3D_LUT.html) | N-Log to Rec.709 | Strong single-source candidate for Nikon Z N-Log conversion LUTs. | Link-only until Nikon terms are reviewed. |
| P0 | DJI | `official-download` | [DJI LUT official download page](https://www.dji.com/global/product/lut) | D-Log, D-Log M, D-Gamut, Zenmuse X9 D-Log to Rec.709 and Rec.2020 HLG, Osmo and drone LUTs | DJI has many product-specific packages. Treat Mavic, Mini, Air, Avata, Osmo, O4, Zenmuse separately. | Link-only until DJI terms are reviewed. |
| P1 | Insta360 | `official-download` | [Insta360 Studio LUT docs](https://onlinemanual.insta360.com/studio/en-us/operation-guide/plugin-features/studio-lut), [Insta360 App LUT docs](https://onlinemanual.insta360.com/app/en-us/operation-tutorial/edit-function/lut) | I-Log / LOG official LUT plugin for Studio/App workflows | Download path is through the product download center. Verify actual zip and model coverage per product. | Link-only until Insta360 terms are reviewed. |
| P1 | Leica | `official-download` | [Leica SL3 downloads](https://leica-camera.com/en-US/photography/cameras/sl/sl3-reporter/downloads), [L-Log Reference Manual v1.6](https://leica-camera.com/sites/default/files/pm-118912-L-Log_Reference_Manual_V1.6.pdf) | Leica L-Log LUTs for BT.709 and BT.2020 workflows | L-Log range handling differs by recording mode. Record full-range/video-level assumptions. | Link-only until Leica terms are reviewed. |
| P1 | OM System / Olympus | `official-download` | [OM System 3D-LUT downloads](https://support.jp.omsystem.com/en/support/imsg/digicamera/download/software/3dlut/3dlutdl.html) | Flat and OM-Log400 to SDR/WDR BT.709; P3-D65 and BT.2020 input variants | Model, codec, and input color space are part of the contract. | Link-only until OM System terms are reviewed. |
| P1 | JVC Professional | `official-download` | [JVC J-Log1 3D-LUT manual/download page](https://www.jvc.com/usa/pro/professional-video/documents/manuals/3dluts-jlog1-hc500hc900ls300/), [J-Log1 PDF](https://www.jvc.com/content/dam/jvc/usa/pro/professional-video/documents/manuals/pdf/PDF_3DLUTs_file_for_J-Log1_of_HC500HC900LS300_20200819b.pdf) | J-Log1 to Rec.709, DCI-P3, XYZ variants | HC500/HC900/LS300 packages include multiple tone/knee choices. | Link-only until JVC terms are reviewed. |
| P1 | Z CAM | `candidate`, `official-generator` | [Z CAM Resources](https://www.z-cam.com/resources/), [ZlogColor Plugin Introduction](https://www.z-cam.com/zlogcolor-plugin-introduction/) | Z-Log2 Wide Gamut to XYZ, Z-Log2 to linear, Z CAM LUT V1.9, ACES IDT files | Legacy official pages for `support/lut/` and `support/aces-workflow/` appeared in search results but returned 404 during this pass. Re-verify current download path before manifest work. | Candidate only until a live download page and terms are verified. |
| P1 | Kinefinity | `official-download`, `official-generator` | [Kinefinity official LUT collection](https://kinefinity.com/workflow_kine_lut/), [KineLOG3 technical specifications](https://kinefinity.com/kinelog3-technical-specifications/) | KineNEUTM, KineNEUT, KC-Neutral, KC-Flat, KineColor2; KineLOG3 transform data | Pair LUTs to KineOS/camera generation; technical specification can support generated transforms. | Link-only until Kinefinity terms are reviewed. |
| P2 | Autel Robotics | `official-download` | [Autel LUT page](https://shop.autelrobotics.com/pages/lut), [EVO II Pro LUT downloads](https://www.autelrobotics.com/doc/497/), [EVO Lite LUT downloads](https://www.autelrobotics.com/doc/490/) | EVO, EVO II, EVO II Pro, EVO Lite LOG creative LUT packs | Autel positions these as creative starting points, not necessarily neutral technical transforms. | Link-only until Autel terms are reviewed. |
| P2 | FiLMiC Pro | `official-download` | [FiLMiC LUTs](https://www.filmicpro.com/luts/) | deFlat, deLOG, LogV2, Apple Log related LUT packs | App-vendor source rather than camera OEM. Keep separate from hardware vendor packages. | Link-only until FiLMiC terms are reviewed. |
| P2 | GoPro | `candidate` | [GoPro Labs LUT discussion](https://github.com/gopro/labs/discussions/627) | GP-Log / LOGB=400 and WIDE color conversion candidates | The found source points to an offsite zip from an official-looking GoPro Labs GitHub discussion, not a stable GoPro support/download page. Verify before importing. | Candidate only. |
| P2 | Blackmagic Design | `bundled-or-account` | [Blackmagic Cinema Camera manual](https://documents.blackmagicdesign.com/UserManuals/BlackmagicCinemaCameraManual.pdf), [Blackmagic Studio Camera manual](https://documents.blackmagicdesign.com/UserManuals/BlackmagicStudioCameraManual4k.pdf) | Gen 5 Film to Extended Video, Video, Rec.2020 HLG, Rec.2020 PQ; Resolve built-in film looks | Many LUTs are bundled in Resolve or camera firmware. The repository policy currently prohibits extracting bundled software LUTs without explicit redistribution permission. | Metadata only unless license permits redistribution. |
| P2 | Apple | `bundled-or-account` | [Final Cut Pro LUT docs](https://support.apple.com/ja-jp/guide/final-cut-pro/ver24f966423/mac), [Final Cut Camera Log playback docs](https://support.apple.com/en-asia/guide/final-cut-camera/dev7c08e7d1c/ios), [Apple Developer downloads search](https://developer.apple.com/download/all/?q=Apple+log+profile) | Apple Log and Apple Log 2 to SDR Rec.709 / HDR HLG | Public docs confirm built-in Apple 3D LUT behavior. Standalone developer download may require sign-in and version review. | Metadata only unless standalone terms permit redistribution. |
| P3 | SIGMA | `candidate` | [SIGMA Color Mode Library](https://www.sigma-global.com/en/shooting-with-sigma/sigma_color_mode_library/), [SIGMA fp specs](https://www.sigmaphoto.com/sigma-fp) | SIGMA fp / fp L color modes | Verified as official color-mode reference, not yet verified as a public `.cube` LUT source. | Candidate only. |

## Monitoring, Post, and Standards Sources

| Priority | Source | Class | Official source | Candidate transforms | Profile notes | Legal default |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | AJA | `official-generator`, `bundled-or-account` | [AJA ColorBox](https://www.aja.com/products/colorbox) | ColorBox pipelines, 33-point 3D LUT workflows, ACES, Colorfront Engine, BBC HLG LUTs | Mostly device/software workflow and licensed transform options rather than a free asset library. | Metadata/recipe only unless sample LUT license is explicit. |
| P1 | Atomos | `bundled-or-account` | [Monitoring Modes and LUTs](https://support.atomos.com/hc/en-us/articles/10342490832271-Monitoring-Modes-LUTs), [3D LUT support](https://support.atomos.com/hc/en-us/articles/226651447-How-can-I-add-and-use-3D-LUT-s-with-my-Atomos-product) | AtomHDR and custom/user LUT monitoring workflows | Current verified sources document LUT import and monitoring behavior, not a stable free camera LUT package. | Metadata only; continue searching before manifest work. |
| P1 | ACES / OpenColorIO | `standards-source` | [OpenColorIO-Config-ACES](https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES), [OpenColorIO](https://github.com/AcademySoftwareFoundation/OpenColorIO), [ACES CLF introduction](https://docs.acescentral.com/clf/introduction/), [ACES CLF specification](https://docs.acescentral.com/clf/specification/) | ACES CTL/CLF/OCIO configs; bakeable display and view transforms | Prefer recipe/manifests for configs and generated LUTs. Preserve upstream license, source tag, and generation command. | Potentially redistributable under upstream licenses; review per config and generated output. |
| P2 | Flanders Scientific / FSI | `candidate` | Search target: `flandersscientific.com LUT downloads` | Monitor LUTs, camera log to Rec.709, calibration LUTs | Not yet verified in this pass as a stable official download URL. | Candidate only. |
| P2 | SmallHD | `candidate` | Search target: `smallhd.com camera LUTs download` | Monitor camera LUTs and user LUT workflow | Not yet verified in this pass as a stable official download URL. | Candidate only. |
| P2 | DaVinci Resolve, Adobe, Final Cut Pro | `bundled-or-account` | Vendor application documentation and installed software packages | Camera LUTs, creative LUTs, film print looks, technical LUTs | The repo policy forbids extracting bundled software LUTs unless the vendor license explicitly allows redistribution. | Metadata only by default. |
| P3 | FilmLight, Colorfront, Light Illusion, Portrait Displays / CalMAN | `candidate`, `official-generator` | Vendor product/support pages to verify later | Baselight/Truelight, Colorfront Engine, display calibration LUTs | These are usually workflow engines or calibration outputs, not broadly redistributable profile assets. | Recipe/metadata only unless license is explicit. |

## Next Manifest Fields To Capture

For each approved asset or generated transform, capture at least:

| Field | Notes |
| --- | --- |
| Vendor | Canonical vendor name. |
| Product / Camera | Camera body, product family, software, or device. |
| LUT Name | Exact package file name and internal `.cube` file name. |
| Type | `technical-output`, `display-look`, `scene-creative`, `combined-look-output`, monitoring, calibration, or unknown. |
| Input Gamma | Example: LogC4, S-Log3, Canon Log 2, V-Log, N-Log, D-Log M. |
| Input Gamut | Example: AWG4, S-Gamut3.Cine, Cinema Gamut, V-Gamut, RWG, Z-Log2 Wide Gamut. |
| Output Gamma | Example: sRGB, Rec.709/BT.1886, gamma 2.4, PQ, HLG, linear. |
| Output Gamut | Example: Rec.709, P3-D65, DCI-P3, Rec.2020, ACES AP0/AP1. |
| Format | `.cube`, `.3dl`, `.spi3d`, `.clf`, `.ctl`, `.ocio`, `.vlt`, plugin package. |
| LUT Size | 17, 33, 65, or other when parseable. |
| Version / Date | Vendor version, package id, release date, crawl date. |
| Official URL | Stable product/download/support URL. |
| License | Exact license or terms URL, not inferred from free download. |
| Redistribution | `allowed`, `denied`, `unclear`, or `local-only`. |
| Contract Source | Example: `source-package-rule`, `manual-review`, `clf-metadata`, or `vendor-manifest`. |
| Contract Source ID | Stable rule, package, or reviewed source identifier. |
| Contract Confidence | `high`, `medium`, or `low` before release review. |
| Notes | Full/legal range, exposure anchor, monitoring vs output use, tone map, highlight roll-off. |

## Repo Import Rule

1. Keep third-party assets in `.local-profile-imports/` or another ignored local
   folder until license review is complete.
2. If terms are unclear, write metadata with `redistributionAllowed: false` and
   do not include the asset in release packs.
3. For camera-log LUTs, require an explicit input and output contract. Filename
   hints are useful for triage but are not enough to define a renderable
   LumaForge profile.
   - The current importer pre-fills reviewed source-package contracts for the
     local ARRI, Autel, FiLMiC Pro, Fujifilm, Leica, Nikon, RED, and Sony
     packages, not from arbitrary `.cube` comments.
   - Treat source-package contract fields as draft metadata that still needs
     human review before release. If a vendor package is not covered by a rule,
     leave the LUT unresolved instead of guessing from a loose filename.
   - Kinefinity is intentionally still unresolved. `.look` sidecars are not
     part of the current import contract, so `KC_NEUT`, `KC_NEUTM`, and
     `kinecolor2_v09_neutral` remain manual-review entries for now.
   - Keep different input curves as separate profile entries. Do not collapse
     LogC3 into LogC4, or F-Log/F-Log2/F-Log2 C into one asset, even when the
     visible look name is the same.
4. Prefer standards-source recipes for ACES/OCIO-derived transforms so that
   generated LUTs remain traceable to source tags and bake commands.
