#!/usr/bin/env node
import { Command } from "commander";

import { importProfiles } from "./import/write-entry";
import { entriesByKind, generateRepositoryIndex } from "./manifest";
import { formatValidationIssue, validateProfiles } from "./manifest/validate";
import { buildReleaseProfiles } from "./release/build";
import { releaseProfiles } from "./release/github";

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
  .option("--redistribution-allowed", "mark imported entries as redistributable", false)
  .option("--dry-run", "print import plan without writing files", false)
  .option("--move", "move source assets instead of copying", false)
  .option("--overwrite-assets", "overwrite existing asset files", false)
  .option("--no-keep-existing-metadata", "replace curated fields in existing manifests")
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
      keepExistingMetadata: options.keepExistingMetadata
    });

    for (const entry of result.written) {
      console.log(`${entry.action}: ${entry.sourcePath} -> ${entry.manifestPath}`);
    }
    console.log(`${result.dryRun ? "planned" : "imported"} ${result.written.length} of ${result.scanned} scanned assets`);

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
    const result = await validateProfiles({ rootDir: process.cwd(), release: options.release });
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
      repo: options.repo
    });
    console.log(`wrote release assets to ${result.outputDir}`);
    console.log(`index: ${result.indexPath}`);
    console.log(`runtime assets: ${result.releaseAssets.length}`);
    console.log(`entry manifests: ${result.entryManifests.length}`);
    console.log(`total upload bytes: ${result.totalBytes}`);
  });

program
  .command("pack")
  .description("Compatibility alias for build-release; writes individual release assets, not archives")
  .requiredOption("--tag <tag>", "release tag")
  .option("--repo <repo>", "GitHub repository owner/name")
  .action(async (options) => {
    const result = await buildReleaseProfiles({
      rootDir: process.cwd(),
      tag: options.tag,
      repo: options.repo
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
      clobber: options.clobber
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
