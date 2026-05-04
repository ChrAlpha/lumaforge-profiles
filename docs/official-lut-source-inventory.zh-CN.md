# 官方 LUT 来源清单

语言: [English](official-lut-source-inventory.md) | [简体中文](official-lut-source-inventory.zh-CN.md)

调研日期：2026-04-28；Fujifilm 补充：2026-04-29

这只是来源清单。除非 vendor 条款明确允许本仓库再分发，否则不要从这些来源提交、打包或发布第三方 LUT 资产。公开下载权限本身不足以进入 release pack。

将这个集合用作本地审查、manifest 草拟和许可证分流的 crawl seed。许可证完成检查前，导入资产应保持 local-only，并设置 `redistributionAllowed: false`。

## 收集分类

| Class | 含义 | 默认仓库动作 |
| --- | --- | --- |
| `official-download` | Vendor 发布公开 LUT 包或下载页。 | 链接并在本地检查；条款清楚前不要再分发。 |
| `official-generator` | Vendor 发布可烘焙 LUT 的工具或文档化 transform。 | 优先记录 recipe/source 元数据；生成 LUT 仍需许可证审查。 |
| `bundled-or-account` | LUT 存在于 vendor 软件、设备固件或需要登录的下载中。 | 除非再分发许可明确，否则只保留 link-only 元数据。 |
| `standards-source` | 开放标准、CTL、CLF、OCIO config 或等价 transform source。 | 保留上游许可证和生成 recipe。 |
| `candidate` | Vendor 或社区提及，但尚未证明是稳定官方资产来源。 | manifest 工作前先验证。 |

## Camera Vendor 来源

| 优先级 | Vendor | Class | 官方来源 | 候选 transforms 和 looks | Profile 备注 | 法律默认值 |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | ARRI | `official-download`, `official-generator` | [ARRI LUT Generator](https://www.arri.com/en/learn-help/learn-help-camera-system/tools/lut-generator/43892-43892), [ARRI LUT naming convention PDF](https://www.arri.com/resource/blob/294602/99cf69084be7f6638181660483d3e39d/arri-lut-naming-convention-logc4-and-logc3-guideline-en-data.pdf) | LogC3 和 LogC4 到 Rec.709、P3、Rec.2020、PQ、HLG；ARRI Look Library | LogC3 和 LogC4 是独立 contract。显式记录 input gamut/transfer 和 output target。 | ARRI package 条款完成审查前保持 link-only。 |
| P0 | RED | `official-download`, `official-generator` | [IPP2 Overview](https://support.red.com/hc/en-us/articles/115004913827-IPP2-Overview), [IPP2 Output Presets](https://www.red.com/download/ipp2-output-presets), [IPP2 LUT Creator docs](https://docs.red.com/955-0004/REDCINE-XProOperationGuide/Content/6_ExportClips/IPP2_LUT_Creator.htm) | REDWideGamutRGB / Log3G10 IPP2 output transforms 到 Rec.709、Rec.2020、HDR variants；creative LUTs | IPP2 将 creative LUT 和 output transform 分开。记录 tone map 和 highlight roll-off 选择。 | Link-only；下载需要接受条款。 |
| P0 | Sony | `official-download` | [Sony LUT information](https://www.sony.com/electronics/support/articles/00258100), [Sony Look Profile 3D LUT downloads](https://www.sony.com/electronics/support/software/00263050), [Sony CineAlta workflow guide](https://pro.sony/s3/2024/11/29133636/Sony_CineAlta_WF_Guide_v1.0.pdf) | S-Gamut/S-Log2、S-Gamut3.Cine/S-Log3、s709、LC-709、LC-709A、VENICE related looks | 保持 S-Gamut3 和 S-Gamut3.Cine 的区分。许多 look 是 monitoring/output look，而不是 neutral transform。 | Sony 条款完成审查前保持 link-only。 |
| P0 | Fujifilm | `official-download` | [FUJIFILM LUT for F-Log / IDT for F-Log](https://www.fujifilm-x.com/en-us/r2/support/download/lut/), [FUJIFILM 3D-LUT by camera model](https://www.fujifilm-x.com/en-us/lut/) | F-Log、F-Log2 和 F-Log2 C technical LUTs 与 IDTs；按机型区分的 F-Log/F-Log2/F-Log2 C 到 ETERNA、ETERNA Bleach Bypass、WDR-709 和 F-Log/F-Log2/F-Log2 C 709 outputs；GFX ETERNA 55 film simulation LUTs，包括 PROVIA、Velvia、ASTIA、Classic Chrome、Classic Neg.、Pro Neg. Std、ACROS、REALA ACE、ETERNA 和 ETERNA Bleach Bypass | 区分 F-Log、F-Log2 和 F-Log2 C。记录输入是 F-Gamut 还是 F-Gamut C、相机型号、33-grid vs 65-grid package，以及 LUT 是 technical output、WDR output 还是 film simulation look。 | Fujifilm 条款完成审查前保持 link-only。 |
| P0 | Canon | `official-download` | [Canon Log 10 to Rec.709 LUT](https://www.cvi.canon.com/nw3s/CanonUSA/DownloadContents/English/0200280202EN.htm), [Canon Log 12 to Rec.709 LUT](https://sg.canon/en/support/0200280302) | Canon Log、Canon Log 2、Canon Log 3、Cinema Gamut 到 BT.709、Wide DR、BT.2020、DCI-P3、PQ、HLG | Canon 有许多按 camera/gamma/bit-depth 区分的支持页包。记录准确 package id 和 version。 | Canon 条款完成审查前保持 link-only。 |
| P0 | Panasonic / LUMIX / VariCam | `official-download` | [Panasonic V-Log LUT download](https://av.jpn.support.panasonic.com/support/global/cs/dsc/download/lut/), [V-Log/V-Gamut RAW output conversion LUT](https://av.jpn.support.panasonic.com/support/global/cs/dsc/download/lut/s1h_raw_lut/index.html), [LUMIX Lab LUT page](https://panasonic.jp/dc/lumix-lab/lut.html) | V-Log / V-Gamut 到 V-709；RAW Gamut 到 V-Log/V-Gamut；LUMIX Lab creator LUTs | 区分 technical V-709 transform 和 LUMIX Lab creative/user LUT。部分相机格式使用 `.vlt`。 | Panasonic 条款完成审查前保持 link-only。 |
| P0 | Nikon | `official-download` | [Nikon N-Log LUT Download Center](https://downloadcenter.nikonimglib.com/en/products/520/N-Log_3D_LUT.html) | N-Log 到 Rec.709 | Nikon Z N-Log conversion LUT 的强单来源候选。 | Nikon 条款完成审查前保持 link-only。 |
| P0 | DJI | `official-download` | [DJI LUT official download page](https://www.dji.com/global/product/lut) | D-Log、D-Log M、D-Gamut、Zenmuse X9 D-Log 到 Rec.709 和 Rec.2020 HLG、Osmo 和 drone LUTs | DJI 有许多按产品区分的包。Mavic、Mini、Air、Avata、Osmo、O4、Zenmuse 应分开处理。 | DJI 条款完成审查前保持 link-only。 |
| P1 | Insta360 | `official-download` | [Insta360 Studio LUT docs](https://onlinemanual.insta360.com/studio/en-us/operation-guide/plugin-features/studio-lut), [Insta360 App LUT docs](https://onlinemanual.insta360.com/app/en-us/operation-tutorial/edit-function/lut) | I-Log / LOG official LUT plugin for Studio/App workflows | 下载路径通过产品下载中心。逐产品验证实际 zip 和 model coverage。 | Insta360 条款完成审查前保持 link-only。 |
| P1 | Leica | `official-download` | [Leica SL3 downloads](https://leica-camera.com/en-US/photography/cameras/sl/sl3-reporter/downloads), [L-Log Reference Manual v1.6](https://leica-camera.com/sites/default/files/pm-118912-L-Log_Reference_Manual_V1.6.pdf) | Leica L-Log LUTs for BT.709 and BT.2020 workflows | L-Log range handling 会随记录模式不同而变化。记录 full-range/video-level 假设。 | Leica 条款完成审查前保持 link-only。 |
| P1 | OM System / Olympus | `official-download` | [OM System 3D-LUT downloads](https://support.jp.omsystem.com/en/support/imsg/digicamera/download/software/3dlut/3dlutdl.html) | Flat 和 OM-Log400 到 SDR/WDR BT.709；P3-D65 和 BT.2020 input variants | Model、codec 和 input color space 都是 contract 的一部分。 | OM System 条款完成审查前保持 link-only。 |
| P1 | JVC Professional | `official-download` | [JVC J-Log1 3D-LUT manual/download page](https://www.jvc.com/usa/pro/professional-video/documents/manuals/3dluts-jlog1-hc500hc900ls300/), [J-Log1 PDF](https://www.jvc.com/content/dam/jvc/usa/pro/professional-video/documents/manuals/pdf/PDF_3DLUTs_file_for_J-Log1_of_HC500HC900LS300_20200819b.pdf) | J-Log1 到 Rec.709、DCI-P3、XYZ variants | HC500/HC900/LS300 packages 包含多种 tone/knee 选择。 | JVC 条款完成审查前保持 link-only。 |
| P1 | Z CAM | `candidate`, `official-generator` | [Z CAM Resources](https://www.z-cam.com/resources/), [ZlogColor Plugin Introduction](https://www.z-cam.com/zlogcolor-plugin-introduction/) | Z-Log2 Wide Gamut 到 XYZ、Z-Log2 到 linear、Z CAM LUT V1.9、ACES IDT files | 旧官方页 `support/lut/` 和 `support/aces-workflow/` 在搜索结果中出现，但本轮访问返回 404。manifest 工作前重新验证当前下载路径。 | 只有在 live download page 和条款完成验证后才作为候选。 |
| P1 | Kinefinity | `official-download`, `official-generator` | [Kinefinity official LUT collection](https://kinefinity.com/workflow_kine_lut/), [KineLOG3 technical specifications](https://kinefinity.com/kinelog3-technical-specifications/) | KineNEUTM、KineNEUT、KC-Neutral、KC-Flat、KineColor2；KineLOG3 transform data | 将 LUT 与 KineOS/camera generation 配对；technical specification 可支持生成 transform。 | Kinefinity 条款完成审查前保持 link-only。 |
| P2 | Autel Robotics | `official-download` | [Autel LUT page](https://shop.autelrobotics.com/pages/lut), [EVO II Pro LUT downloads](https://www.autelrobotics.com/doc/497/), [EVO Lite LUT downloads](https://www.autelrobotics.com/doc/490/) | EVO、EVO II、EVO II Pro、EVO Lite LOG creative LUT packs | Autel 将这些定位为 creative starting points，不一定是 neutral technical transform。 | Autel 条款完成审查前保持 link-only。 |
| P2 | FiLMiC Pro | `official-download` | [FiLMiC LUTs](https://www.filmicpro.com/luts/) | deFlat、deLOG、LogV2、Apple Log related LUT packs | App-vendor source，而不是 camera OEM。与硬件 vendor 包保持区分。 | FiLMiC 条款完成审查前保持 link-only。 |
| P2 | GoPro | `candidate` | [GoPro Labs LUT discussion](https://github.com/gopro/labs/discussions/627) | GP-Log / LOGB=400 and WIDE color conversion candidates | 已找到的来源指向一个来自官方风格 GoPro Labs GitHub discussion 的站外 zip，而不是稳定 GoPro support/download page。导入前验证。 | 仅候选。 |
| P2 | Blackmagic Design | `bundled-or-account` | [Blackmagic Cinema Camera manual](https://documents.blackmagicdesign.com/UserManuals/BlackmagicCinemaCameraManual.pdf), [Blackmagic Studio Camera manual](https://documents.blackmagicdesign.com/UserManuals/BlackmagicStudioCameraManual4k.pdf) | Gen 5 Film 到 Extended Video、Video、Rec.2020 HLG、Rec.2020 PQ；Resolve built-in film looks | 许多 LUT 随 Resolve 或相机固件捆绑。当前仓库政策禁止在没有明确再分发许可时提取 bundled software LUT。 | 除非许可证允许再分发，否则只保留元数据。 |
| P2 | Apple | `bundled-or-account` | [Final Cut Pro LUT docs](https://support.apple.com/ja-jp/guide/final-cut-pro/ver24f966423/mac), [Final Cut Camera Log playback docs](https://support.apple.com/en-asia/guide/final-cut-camera/dev7c08e7d1c/ios), [Apple Developer downloads search](https://developer.apple.com/download/all/?q=Apple+log+profile) | Apple Log 和 Apple Log 2 到 SDR Rec.709 / HDR HLG | 公开文档确认内置 Apple 3D LUT 行为。独立开发者下载可能需要登录和版本审查。 | 除非独立条款允许再分发，否则只保留元数据。 |
| P3 | SIGMA | `candidate` | [SIGMA Color Mode Library](https://www.sigma-global.com/en/shooting-with-sigma/sigma_color_mode_library/), [SIGMA fp specs](https://www.sigmaphoto.com/sigma-fp) | SIGMA fp / fp L color modes | 已验证为官方 color-mode reference，尚未验证为公开 `.cube` LUT 来源。 | 仅候选。 |

## Monitoring、Post 和 Standards 来源

| 优先级 | Source | Class | 官方来源 | 候选 transforms | Profile 备注 | 法律默认值 |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | AJA | `official-generator`, `bundled-or-account` | [AJA ColorBox](https://www.aja.com/products/colorbox) | ColorBox pipelines、33-point 3D LUT workflows、ACES、Colorfront Engine、BBC HLG LUTs | 多数是设备/软件 workflow 和 licensed transform 选项，而不是免费资产库。 | 除非 sample LUT license 明确，否则只保留 metadata/recipe。 |
| P1 | Atomos | `bundled-or-account` | [Monitoring Modes and LUTs](https://support.atomos.com/hc/en-us/articles/10342490832271-Monitoring-Modes-LUTs), [3D LUT support](https://support.atomos.com/hc/en-us/articles/226651447-How-can-I-add-and-use-3D-LUT-s-with-my-Atomos-product) | AtomHDR 和 custom/user LUT monitoring workflows | 当前已验证来源记录 LUT import 和 monitoring 行为，不是稳定免费 camera LUT package。 | 只保留元数据；manifest 工作前继续搜索。 |
| P1 | ACES / OpenColorIO | `standards-source` | [OpenColorIO-Config-ACES](https://github.com/AcademySoftwareFoundation/OpenColorIO-Config-ACES), [OpenColorIO](https://github.com/AcademySoftwareFoundation/OpenColorIO), [ACES CLF introduction](https://docs.acescentral.com/clf/introduction/), [ACES CLF specification](https://docs.acescentral.com/clf/specification/) | ACES CTL/CLF/OCIO configs；可烘焙 display 和 view transforms | 对 configs 和生成 LUT 优先使用 recipe/manifest。保留上游 license、source tag 和 generation command。 | 在上游许可证下可能可再分发；按 config 和生成输出分别审查。 |
| P2 | Flanders Scientific / FSI | `candidate` | Search target: `flandersscientific.com LUT downloads` | Monitor LUTs、camera log to Rec.709、calibration LUTs | 本轮尚未验证为稳定官方下载 URL。 | 仅候选。 |
| P2 | SmallHD | `candidate` | Search target: `smallhd.com camera LUTs download` | Monitor camera LUTs 和 user LUT workflow | 本轮尚未验证为稳定官方下载 URL。 | 仅候选。 |
| P2 | DaVinci Resolve, Adobe, Final Cut Pro | `bundled-or-account` | Vendor application documentation 和 installed software packages | Camera LUTs、creative LUTs、film print looks、technical LUTs | 仓库政策禁止提取 bundled software LUT，除非 vendor license 明确允许再分发。 | 默认只保留元数据。 |
| P3 | FilmLight, Colorfront, Light Illusion, Portrait Displays / CalMAN | `candidate`, `official-generator` | 稍后验证的 vendor product/support pages | Baselight/Truelight、Colorfront Engine、display calibration LUTs | 这些通常是 workflow engine 或 calibration output，不是可广泛再分发的 profile asset。 | 除非许可证明确，否则只保留 recipe/metadata。 |

## 后续 Manifest 字段

对每个已批准资产或生成 transform，至少记录：

| 字段 | 备注 |
| --- | --- |
| Vendor | 规范 vendor 名称。 |
| Product / Camera | Camera body、product family、software 或 device。 |
| LUT Name | 准确的 package 文件名和内部 `.cube` 文件名。 |
| Type | `technical-output`、`display-look`、`scene-creative`、`combined-look-output`、monitoring、calibration 或 unknown。 |
| Input Gamma | 例如 LogC4、S-Log3、Canon Log 2、V-Log、N-Log、D-Log M。 |
| Input Gamut | 例如 AWG4、S-Gamut3.Cine、Cinema Gamut、V-Gamut、RWG、Z-Log2 Wide Gamut。 |
| Output Gamma | 例如 sRGB、Rec.709/BT.1886、gamma 2.4、PQ、HLG、linear。 |
| Output Gamut | 例如 Rec.709、P3-D65、DCI-P3、Rec.2020、ACES AP0/AP1。 |
| Format | `.cube`、`.3dl`、`.spi3d`、`.clf`、`.ctl`、`.ocio`、`.vlt`、plugin package。 |
| LUT Size | 可解析时记录 17、33、65 或其他。 |
| Version / Date | Vendor version、package id、release date、crawl date。 |
| Official URL | 稳定 product/download/support URL。 |
| License | 准确 license 或 terms URL，不能从免费下载推断。 |
| Redistribution | `allowed`、`denied`、`unclear` 或 `local-only`。 |
| Contract Source | 例如 `source-package-rule`、`manual-review`、`clf-metadata` 或 `vendor-manifest`。 |
| Contract Source ID | 稳定 rule、package 或 reviewed source identifier。 |
| Contract Confidence | release 审查前的 `high`、`medium` 或 `low`。 |
| Notes | Full/legal range、exposure anchor、monitoring vs output use、tone map、highlight roll-off。 |

## 仓库导入规则

1. 第三方资产在许可证审查完成前，应保存在 `.local-profile-imports/` 或其他被忽略的本地目录中。
2. 如果条款不清楚，写入 `redistributionAllowed: false` 的元数据，并且不要把资产包含进 release pack。
3. 对 camera-log LUT，要求显式输入和输出 contract。文件名提示可用于 triage，但不足以定义可渲染的 LumaForge profile。
   - 当前 importer 会为本地 ARRI、Autel、DJI、FiLMiC Pro、Fujifilm、Insta360、Leica、Nikon、OM System、Panasonic、RED 和 Sony package 预填已审查 source-package contract，而不是来自任意 `.cube` 注释。
   - 将 source-package contract 字段视为草稿元数据，release 前仍需人工审查。如果某个 vendor package 没有规则覆盖，应让 LUT 保持 unresolved，而不是从松散文件名猜测。
   - Kinefinity 有意仍保持 unresolved。`.look` sidecar 不属于当前 import contract，因此 `KC_NEUT`、`KC_NEUTM` 和 `kinecolor2_v09_neutral` 目前仍是 manual-review entries。
   - GoPro 在本地存在稳定官方包之前仍为 candidate-only；不要因为社区链接或文件名猜测就将其提升到已审查规则集。
   - 不同输入曲线应保持为不同 profile entry。不要将 LogC3 合并为 LogC4，或将 F-Log/F-Log2/F-Log2 C 合并为一个资产，即使可见 look 名称相同。
4. 对 ACES/OCIO 派生 transform，优先使用 standards-source recipe，使生成 LUT 可追溯到 source tag 和 bake command。
