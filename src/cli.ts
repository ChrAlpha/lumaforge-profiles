#!/usr/bin/env node
import { Command } from "commander";

import { loadDotenvFiles } from "./env";
import { importProfiles } from "./import/write-entry";
import { entriesByKind, generateRepositoryIndex } from "./manifest";
import { formatValidationIssue, validateProfiles } from "./manifest/validate";
import { buildReleaseProfiles } from "./release/build";
import { releaseProfiles } from "./release/github";
import { buildR2Release, loadBuiltR2Release } from "./release/r2-build";
import { runR2Gc } from "./release/r2-gc";
import { R2Publisher } from "./release/r2-publisher";
import { loadR2ConfigFromEnv, R2ObjectStore } from "./release/r2-store";

loadDotenvFiles({ cwd: process.cwd() });

function printValidation(result: Awaited<ReturnType<typeof validateProfiles>>) {
  for (const warning of result.warnings) {
    console.warn(`warning ${formatValidationIssue(warning)}`);
  }
  for (const error of result.errors) {
    console.error(`error ${formatValidationIssue(error)}`);
  }
  console.log(`validated ${result.manifests.length} profile entries`);
}

const program = new Command();

program
  .name("profiles")
  .description("Manage the LumaForge flattened profiles registry")
  .version("0.1.0");

program
  .command("import")
  .description("Import local LUT/DCP/LCP assets into flattened profile entries")
  .requiredOption("--from <dir>", "local import directory")
  .option("--namespace <namespace>", "entry namespace", "lumaforge")
  .option("--version <version>", "entry semantic version", "1.0.0")
  .option("--source <source>", "profile source", "local-import")
  .option("--source-url <url>", "source URL")
  .option("--license <license>", "profile license")
  .option("--author <author>", "profile author")
  .option(
    "--redistribution-allowed",
    "mark imported entries as redistributable",
    false,
  )
  .option("--dry-run", "print import plan without writing files", false)
  .option("--move", "move source assets instead of copying", false)
  .option("--overwrite-assets", "overwrite existing asset files", false)
  .option(
    "--migrate-luts-to-acescct-ap1",
    "convert supported imported .cube LUTs to ACEScct / ACES AP1 input",
    false,
  )
  .option(
    "--canonical-lut-size <size>",
    "grid size for migrated ACEScct / ACES AP1 LUTs",
    (value) => Number(value),
    65,
  )
  .option(
    "--no-keep-existing-metadata",
    "replace curated fields in existing manifests",
  )
  .action(async (options) => {
    const result = await importProfiles({
      rootDir: process.cwd(),
      fromDir: options.from,
      namespace: options.namespace,
      version: options.version,
      source: options.source,
      sourceUrl: options.sourceUrl ?? null,
      license: options.license,
      author: options.author,
      redistributionAllowed: options.redistributionAllowed,
      dryRun: options.dryRun,
      move: options.move,
      overwriteAssets: options.overwriteAssets,
      keepExistingMetadata: options.keepExistingMetadata,
      migrateLutsToAcescctAp1: options.migrateLutsToAcescctAp1,
      canonicalLutSize: options.canonicalLutSize,
    });

    for (const entry of result.written) {
      const migration = entry.migration
        ? ` [${entry.migration.mode}:${entry.migration.action}${entry.migration.reason ? `:${entry.migration.reason}` : ""}]`
        : "";
      console.log(
        `${entry.action}: ${entry.sourcePath} -> ${entry.manifestPath}${migration}`,
      );
    }
    console.log(
      `${result.dryRun ? "planned" : "imported"} ${result.written.length} of ${result.scanned} scanned assets`,
    );

    if (result.validation) {
      printValidation(result.validation);
      if (result.validation.errors.length > 0) {
        process.exitCode = 1;
      }
    }
  });

program
  .command("validate")
  .description("Validate flattened profile manifests and local assets")
  .option("--release", "treat release-safety warnings as errors", false)
  .action(async (options) => {
    const result = await validateProfiles({
      rootDir: process.cwd(),
      release: options.release,
    });
    printValidation(result);
    if (result.errors.length > 0) {
      process.exitCode = 1;
    }
  });

program
  .command("index")
  .description("Regenerate lumaforge-profiles.json")
  .action(async () => {
    const index = await generateRepositoryIndex({ rootDir: process.cwd() });
    console.log(`indexed ${index.entries.length} entries`);
    for (const [kind, count] of Object.entries(entriesByKind(index.entries))) {
      console.log(`${kind}: ${count}`);
    }
  });

program
  .command("build-release")
  .description("Build GitHub Release assets with one file per profile asset")
  .requiredOption("--tag <tag>", "release tag")
  .option("--repo <repo>", "GitHub repository owner/name")
  .action(async (options) => {
    const result = await buildReleaseProfiles({
      rootDir: process.cwd(),
      tag: options.tag,
      repo: options.repo,
    });
    console.log(`wrote release assets to ${result.outputDir}`);
    console.log(`index: ${result.indexPath}`);
    console.log(`runtime assets: ${result.releaseAssets.length}`);
    console.log(`entry manifests: ${result.entryManifests.length}`);
    console.log(`total upload bytes: ${result.totalBytes}`);
  });

program
  .command("build-r2")
  .description(
    "Build Cloudflare R2/CDN release artifacts with content-addressed blobs",
  )
  .requiredOption("--tag <tag>", "release tag")
  .option("--public-base-url <url>", "public CDN base URL")
  .option("--channel <name...>", "channel names to embed in release metadata")
  .action(async (options) => {
    const result = await buildR2Release({
      rootDir: process.cwd(),
      tag: options.tag,
      publicBaseUrl: options.publicBaseUrl,
      channelNames: options.channel,
      now: process.env.LUMAFORGE_PROFILES_NOW,
    });
    console.log(`wrote R2 release artifacts to ${result.outputDir}`);
    console.log(`catalog: ${result.catalogPath}`);
    console.log(`release: ${result.releasePath}`);
    console.log(`entries: ${result.entries.length}`);
    console.log(`unique blobs: ${result.blobs.length}`);
    console.log(`blob bytes: ${result.release.totalBlobBytes}`);
  });

program
  .command("publish-r2")
  .description(
    "Publish a previously built R2 release to Cloudflare R2 and update channels last",
  )
  .requiredOption("--tag <tag>", "release tag")
  .option(
    "--channel <name...>",
    "channel names",
    process.env.LUMAFORGE_PROFILES_CHANNEL?.split(",").filter(Boolean),
  )
  .option("--dry-run", "print the upload plan without writing objects", false)
  .option("--yes", "execute uploads", false)
  .action(async (options) => {
    const config = loadR2ConfigFromEnv();
    const store = new R2ObjectStore(config);
    const publisher = new R2Publisher({
      bucket: config.bucket,
      publicBaseUrl: config.publicBaseUrl,
      store,
    });
    const build = await loadBuiltR2Release({
      rootDir: process.cwd(),
      tag: options.tag,
    });
    const dryRun = options.dryRun || !options.yes;
    const result = await publisher.publish({
      build,
      channelNames: options.channel ?? [],
      dryRun,
    });
    console.log(`bucket: ${result.bucket}`);
    console.log(`tag: ${result.tag}`);
    console.log(`objects: ${result.objects.length}`);
    console.log(`uploaded blobs: ${result.uploadedBlobCount}`);
    console.log(`skipped blobs: ${result.skippedBlobCount}`);
    console.log(`estimated Class A ops: ${result.estimatedClassAOperations}`);
    console.log(`estimated Class B ops: ${result.estimatedClassBOperations}`);
    for (const update of result.channelUpdates) {
      console.log(
        `channel\t${update.channel}\t${update.previousTag ?? "(none)"} -> ${update.nextTag}`,
      );
    }
    for (const object of result.objects) {
      console.log(`${object.action}\t${object.phase}\t${object.key}`);
    }
    if (result.dryRun) {
      console.log("dry-run: no R2 objects were uploaded");
    }
  });

program
  .command("r2-gc")
  .description(
    "Plan or execute Cloudflare R2 garbage collection for old releases and unreferenced blobs",
  )
  .option(
    "--keep-releases <count>",
    "keep the most recent N releases in addition to channel references",
    (value) => Number(value),
    0,
  )
  .option("--keep-tags <tags>", "comma-separated release tags to keep")
  .option("--channel <name...>", "channel names to protect", [
    "stable",
    "latest",
  ])
  .option("--dry-run", "print the delete plan without removing objects", false)
  .option("--yes", "execute deletions", false)
  .action(async (options) => {
    const config = loadR2ConfigFromEnv();
    const store = new R2ObjectStore(config);
    const dryRun = options.dryRun || !options.yes;
    const keepTags =
      typeof options.keepTags === "string"
        ? options.keepTags
            .split(",")
            .map((item: string) => item.trim())
            .filter(Boolean)
        : [];
    const result = await runR2Gc({
      store,
      keepReleases: options.keepReleases,
      keepTags,
      channelNames: options.channel,
      dryRun,
    });
    console.log(`keep tags: ${result.keepTags.join(", ") || "(none)"}`);
    console.log(`delete objects: ${result.deleteKeys.length}`);
    console.log(`delete bytes: ${result.deleteBytes}`);
    console.log(`estimated Class A ops: ${result.estimatedClassAOperations}`);
    console.log(`estimated Class B ops: ${result.estimatedClassBOperations}`);
    for (const key of result.deleteKeys) {
      console.log(`delete\t${key}`);
    }
    if (result.dryRun) {
      console.log("dry-run: no R2 objects were deleted");
    }
  });

program
  .command("pack")
  .description(
    "Compatibility alias for build-release; writes individual release assets, not archives",
  )
  .requiredOption("--tag <tag>", "release tag")
  .option("--repo <repo>", "GitHub repository owner/name")
  .action(async (options) => {
    const result = await buildReleaseProfiles({
      rootDir: process.cwd(),
      tag: options.tag,
      repo: options.repo,
    });
    console.log(`wrote release assets to ${result.outputDir}`);
    console.log(`index: ${result.indexPath}`);
    console.log(`runtime assets: ${result.releaseAssets.length}`);
    console.log(`entry manifests: ${result.entryManifests.length}`);
    console.log(`total upload bytes: ${result.totalBytes}`);
  });

program
  .command("release")
  .description("Create or upload GitHub Release assets")
  .requiredOption("--tag <tag>", "release tag")
  .option("--repo <repo>", "GitHub repository owner/name")
  .option("--dry-run", "print gh commands without executing them", false)
  .option("--yes", "execute gh commands", false)
  .option("--draft", "create release as draft", false)
  .option("--prerelease", "mark release as prerelease", false)
  .option("--clobber", "overwrite existing release assets", false)
  .action(async (options) => {
    const dryRun = options.dryRun || !options.yes;
    const result = await releaseProfiles({
      rootDir: process.cwd(),
      tag: options.tag,
      repo: options.repo,
      dryRun,
      draft: options.draft,
      prerelease: options.prerelease,
      clobber: options.clobber,
    });
    console.log(`repo: ${result.repo}`);
    console.log(`tag: ${result.tag}`);
    console.log(`index: ${result.indexPath}`);
    console.log(`release assets: ${result.assetCount}`);
    console.log(`total upload bytes: ${result.totalBytes}`);
    for (const command of result.commands) {
      console.log(command.join(" "));
    }
    if (result.dryRun) {
      console.log("dry-run: no GitHub commands were executed");
    }
  });

await program.parseAsync(process.argv);
