import { createReadStream } from "node:fs";

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type { ObjectStore, PutObjectInput } from "./object-store";
import { DEFAULT_R2_PUBLIC_BASE_URL } from "./r2-shared";

export interface R2Config {
  accountId: string;
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

export function loadR2ConfigFromEnv(): R2Config {
  const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
  return {
    accountId,
    bucket: requiredEnv("CLOUDFLARE_R2_BUCKET"),
    endpoint:
      process.env.CLOUDFLARE_R2_ENDPOINT?.trim() ||
      `https://${accountId}.r2.cloudflarestorage.com`,
    accessKeyId: requiredEnv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    publicBaseUrl:
      process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL?.trim() ||
      DEFAULT_R2_PUBLIC_BASE_URL,
  };
}

export class R2ObjectStore implements ObjectStore {
  private readonly client: S3Client;

  constructor(private readonly config: R2Config) {
    this.client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async headObject(key: string) {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (error) {
      if (
        (error instanceof Error && /NotFound|404/i.test(error.name)) ||
        String(error).includes("NotFound") ||
        String(error).includes("404")
      ) {
        return false;
      }
      throw error;
    }
  }

  async putObject(input: PutObjectInput) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: createReadStream(input.bodyPath),
        ContentType: input.contentType,
        CacheControl: input.cacheControl,
      }),
    );
  }

  async listObjects(prefix: string) {
    const objects: Array<{ key: string; size: number }> = [];
    let continuationToken: string | undefined;
    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const object of response.Contents ?? []) {
        if (!object.Key) {
          continue;
        }
        objects.push({
          key: object.Key,
          size: Number(object.Size ?? 0),
        });
      }
      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken);
    return objects.sort((a, b) => a.key.localeCompare(b.key));
  }

  async getJson<T>(key: string) {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
      const raw = await response.Body?.transformToString();
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (error) {
      if (
        (error instanceof Error &&
          /NoSuchKey|NotFound|404/i.test(error.name)) ||
        String(error).includes("NoSuchKey") ||
        String(error).includes("NotFound") ||
        String(error).includes("404")
      ) {
        return null;
      }
      throw error;
    }
  }

  async deleteObjects(keys: string[]) {
    const batchSize = 1000;
    for (let index = 0; index < keys.length; index += batchSize) {
      const batch = keys.slice(index, index + batchSize);
      if (batch.length === 0) {
        continue;
      }
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.config.bucket,
          Delete: {
            Objects: batch.map((key) => ({ Key: key })),
            Quiet: true,
          },
        }),
      );
    }
  }
}
