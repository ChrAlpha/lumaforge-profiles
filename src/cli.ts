#!/usr/bin/env node
import { Command } from "commander";

import { importProfiles } from "./import/write-entry";
import { entriesByKind, generateRepositoryIndex } from "./manifest";
import { formatValidationIssue, validateProfiles } from "./manifest/validate";
import { packProfiles, type PackName } from "./pack/pack";
import { releaseProfiles } from "./release/github";

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

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
  .command("pack")
  .description("Build GitHub Release zip packs")
  .requiredOption("--tag <tag>", "release tag")
  .option("--packs <packs>", "comma-separated packs: all,luts,dcp,lcp", "all,luts,dcp,lcp")
  .action(async (options) => {
    const result = await packProfiles({
      rootDir: process.cwd(),
      tag: options.tag,
      packs: parseList(options.packs) as PackName[]
    });
    console.log(`wrote ${result.packs.length} packs to ${result.outputDir}`);
    for (const pack of result.packs) {
      console.log(`${pack.fileName} ${pack.sha256}`);
    }
  });

program
  .command("release")
  .description("Create or upload GitHub Release assets")
  .requiredOption("--tag <tag>", "release tag")
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
      dryRun,
      draft: options.draft,
      prerelease: options.prerelease,
      clobber: options.clobber
    });
    for (const command of result.commands) {
      console.log(command.join(" "));
    }
    if (result.dryRun) {
      console.log("dry-run: no GitHub commands were executed");
    }
  });

await program.parseAsync(process.argv);
