import { z } from "zod";

import { PROFILE_KINDS } from "./types";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);

export const profileAssetSchema = z
  .object({
    role: z.string().min(1),
    path: z.string().min(1),
    mediaType: z.string().min(1),
    byteSize: z.number().int().nonnegative(),
    sha256: sha256Schema
  })
  .passthrough();

export const profileEntryManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/),
    kind: z.enum(PROFILE_KINDS),
    format: z.string().min(1),
    version: z.string().min(1),
    title: z.string().min(1),
    description: z.string().nullable(),
    license: z.string(),
    author: z.string(),
    source: z.string().min(1),
    sourceUrl: z.string().nullable(),
    redistributionAllowed: z.boolean(),
    targets: z.record(z.unknown()),
    assets: z.array(profileAssetSchema).min(1),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1)
  })
  .passthrough();

export const repositoryManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    entriesRoot: z.string().min(1),
    defaultEntryGlob: z.string().min(1),
    generatedAt: z.string().min(1),
    entries: z.array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(PROFILE_KINDS),
        version: z.string().min(1),
        title: z.string().min(1),
        manifest: z.string().min(1)
      })
    )
  })
  .passthrough();

export const releasePackManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    tag: z.string().min(1),
    kindFilter: z.array(z.enum(PROFILE_KINDS)),
    entryCount: z.number().int().nonnegative(),
    assetCount: z.number().int().nonnegative(),
    uncompressedBytes: z.number().int().nonnegative(),
    generatedAt: z.string().min(1),
    entries: z.array(
      z.object({
        id: z.string().min(1),
        manifest: z.string().min(1)
      })
    )
  })
  .passthrough();

export const releaseManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    tag: z.string().min(1),
    generatedAt: z.string().min(1),
    totalEntries: z.number().int().nonnegative(),
    entriesByKind: z.record(z.number().int().nonnegative()),
    packs: z.array(
      z.object({
        fileName: z.string().min(1),
        mediaType: z.literal("application/zip"),
        byteSize: z.number().int().nonnegative(),
        sha256: sha256Schema,
        entryCount: z.number().int().nonnegative(),
        assetCount: z.number().int().nonnegative(),
        kindFilter: z.array(z.enum(PROFILE_KINDS))
      })
    )
  })
  .passthrough();

export function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
}
