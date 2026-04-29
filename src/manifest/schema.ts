import { z } from "zod";

import { PROFILE_ASSET_ROLES, PROFILE_KINDS } from "./types";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);

export const profileAssetSchema = z
  .object({
    role: z.enum(PROFILE_ASSET_ROLES),
    path: z.string().min(1),
    mediaType: z.string().min(1),
    byteSize: z.number().int().positive(),
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

export const releaseIndexSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    version: z.string().min(1),
    generatedAt: z.string().min(1),
    release: z.object({
      provider: z.literal("github"),
      owner: z.string().min(1),
      repo: z.string().min(1),
      tag: z.string().min(1)
    }),
    entries: z.array(
      z.object({
        schemaVersion: z.literal(1),
        id: z.string().min(1),
        kind: z.enum(PROFILE_KINDS),
        version: z.string().min(1),
        title: z.string().min(1),
        license: z.string().min(1),
        redistributionAllowed: z.literal(true),
        manifest: z.object({
          originalPath: z.string().min(1),
          releaseAssetName: z.string().regex(/^[A-Za-z0-9._-]+$/)
        }),
        assets: z.array(
          z.object({
            role: z.enum(PROFILE_ASSET_ROLES),
            mediaType: z.string().min(1),
            originalPath: z.string().min(1),
            releaseAssetName: z.string().regex(/^[A-Za-z0-9._-]+$/),
            size: z.number().int().positive(),
            sha256: sha256Schema,
            download: z.object({
              type: z.literal("github-release-asset"),
              url: z.string().url()
            })
          })
        )
      })
    )
  })
  .passthrough();

export function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
}
