import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type { ObjectStore, PutObjectInput } from "./object-store";
import { DEFAULT_S3_PUBLIC_BASE_URL } from "./s3-shared";

export interface S3Config {
  bucket: string;
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
}

function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function requiredEnv(...names: string[]) {
  const value = envValue(...names);
  if (!value) {
    const label =
      names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
    throw new Error(`Missing required environment variable ${label}.`);
  }
  return value;
}

function booleanEnv(name: string) {
  const value = envValue(name);
  if (!value) {
    return false;
  }
  if (/^(1|true|yes|on)$/i.test(value)) {
    return true;
  }
  if (/^(0|false|no|off)$/i.test(value)) {
    return false;
  }
  throw new Error(
    `${name} must be one of true, false, 1, 0, yes, no, on, or off.`,
  );
}

export function loadS3ConfigFromEnv(): S3Config {
  return {
    bucket: requiredEnv("S3_BUCKET"),
    endpoint: envValue("S3_ENDPOINT"),
    region:
      envValue("S3_REGION", "AWS_REGION", "AWS_DEFAULT_REGION") ??
      "us-east-1",
    accessKeyId: requiredEnv("S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv(
      "S3_SECRET_ACCESS_KEY",
      "AWS_SECRET_ACCESS_KEY",
    ),
    sessionToken: envValue("S3_SESSION_TOKEN", "AWS_SESSION_TOKEN"),
    publicBaseUrl: envValue("S3_PUBLIC_BASE_URL") ?? DEFAULT_S3_PUBLIC_BASE_URL,
    forcePathStyle: booleanEnv("S3_FORCE_PATH_STYLE"),
  };
}

export class S3ObjectStore implements ObjectStore {
  private readonly client: S3Client;

  constructor(private readonly config: S3Config) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken,
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
    const { size } = await stat(input.bodyPath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: createReadStream(input.bodyPath),
        ContentLength: size,
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
