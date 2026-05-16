import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";

import type { BrowserReleasePackage, BrowserReleasePackageFile } from "./release";

type PublishPlanObjectAction = "check-remote" | "upload";
type PublishPlanObjectPhase =
  | "blob"
  | "release-entry"
  | "release-catalog"
  | "release-metadata"
  | "channel";

interface PublishPlanObject {
  phase: PublishPlanObjectPhase;
  key: string;
  localPath: string;
  contentType: string;
  cacheControl: string;
  action: PublishPlanObjectAction;
}

interface PublishPlan {
  objects: PublishPlanObject[];
}

export interface BrowserS3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface BrowserS3PublishTransport {
  headObject(key: string): Promise<boolean>;
  putObject(input: {
    key: string;
    body: string;
    contentType: string;
    cacheControl: string;
  }): Promise<void>;
}

export interface BrowserS3PublishOptions {
  bucket: string;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  credentials: BrowserS3Credentials;
  transport?: BrowserS3PublishTransport;
}

export interface BrowserS3PublishResult {
  uploaded: string[];
  skipped: string[];
}

export interface BrowserGithubPublishOptions {
  owner: string;
  repo: string;
  token: string;
  draft?: boolean;
  prerelease?: boolean;
  fetcher?: typeof fetch;
}

export interface BrowserGithubPublishResult {
  releaseId: number;
  uploadedAssets: string[];
}

function packageFileMap(releasePackage: BrowserReleasePackage) {
  return new Map(releasePackage.files.map((file) => [file.path, file]));
}

function readPublishPlan(releasePackage: BrowserReleasePackage): PublishPlan {
  const file = packageFileMap(releasePackage).get("publish-plan.json");
  if (!file) {
    throw new Error("Release package is missing publish-plan.json.");
  }
  return JSON.parse(file.body) as PublishPlan;
}

function objectSortPriority(object: PublishPlanObject) {
  if (object.phase === "channel") {
    return 2;
  }
  if (object.phase === "blob") {
    return 0;
  }
  return 1;
}

function findPackageFile(files: Map<string, BrowserReleasePackageFile>, object: PublishPlanObject) {
  const file = files.get(object.localPath) ?? files.get(object.key);
  if (!file) {
    throw new Error(`Release package is missing ${object.localPath} for ${object.key}.`);
  }
  return file;
}

export function createBrowserS3Transport(options: BrowserS3PublishOptions): BrowserS3PublishTransport {
  const config: S3ClientConfig = {
    region: options.region ?? "auto",
    endpoint: options.endpoint,
    forcePathStyle: options.forcePathStyle,
    credentials: {
      accessKeyId: options.credentials.accessKeyId,
      secretAccessKey: options.credentials.secretAccessKey,
      ...(options.credentials.sessionToken ? { sessionToken: options.credentials.sessionToken } : {}),
    },
  };
  const client = new S3Client(config);

  return {
    async headObject(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: options.bucket, Key: key }));
        return true;
      } catch (error) {
        const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (statusCode === 404 || statusCode === 403) {
          return false;
        }
        throw error;
      }
    },
    async putObject(input) {
      await client.send(
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          CacheControl: input.cacheControl,
        }),
      );
    },
  };
}

export async function publishBrowserS3ReleasePackage(
  releasePackage: BrowserReleasePackage,
  options: BrowserS3PublishOptions,
): Promise<BrowserS3PublishResult> {
  const files = packageFileMap(releasePackage);
  const plan = readPublishPlan(releasePackage);
  const transport = options.transport ?? createBrowserS3Transport(options);
  const uploaded: string[] = [];
  const skipped: string[] = [];
  const objects = [...plan.objects].sort((a, b) => objectSortPriority(a) - objectSortPriority(b));

  for (const object of objects) {
    if (object.action === "check-remote" && await transport.headObject(object.key)) {
      skipped.push(object.key);
      continue;
    }

    const file = findPackageFile(files, object);
    await transport.putObject({
      key: object.key,
      body: file.body,
      contentType: object.contentType,
      cacheControl: object.cacheControl,
    });
    uploaded.push(object.key);
  }

  return {
    uploaded,
    skipped,
  };
}

function githubApiHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function uploadAssetName(releasePackage: BrowserReleasePackage, file: BrowserReleasePackageFile) {
  const leaf = file.path.split("/").pop() ?? file.path;
  return `lumaforge-profiles.${releasePackage.tag}.${leaf}`;
}

async function githubJson<T>(response: Response, context: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${context} failed with HTTP ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

async function getOrCreateGithubRelease(
  releasePackage: BrowserReleasePackage,
  options: Required<Pick<BrowserGithubPublishOptions, "fetcher">> & BrowserGithubPublishOptions,
) {
  const apiBase = `https://api.github.com/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repo)}`;
  const headers = githubApiHeaders(options.token);
  const getResponse = await options.fetcher(`${apiBase}/releases/tags/${encodeURIComponent(releasePackage.tag)}`, {
    headers,
  });
  if (getResponse.ok) {
    return githubJson<{ id: number; upload_url: string }>(getResponse, "Load GitHub release");
  }
  if (getResponse.status !== 404) {
    throw new Error(`Load GitHub release failed with HTTP ${getResponse.status}.`);
  }

  const createResponse = await options.fetcher(`${apiBase}/releases`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tag_name: releasePackage.tag,
      name: releasePackage.tag,
      draft: options.draft ?? false,
      prerelease: options.prerelease ?? false,
    }),
  });
  return githubJson<{ id: number; upload_url: string }>(createResponse, "Create GitHub release");
}

function uploadUrl(baseUploadUrl: string, name: string) {
  const base = baseUploadUrl.replace(/\{\?name,label\}$/, "");
  const url = new URL(base);
  url.searchParams.set("name", name);
  return url.toString();
}

export async function publishBrowserGithubRelease(
  releasePackage: BrowserReleasePackage,
  options: BrowserGithubPublishOptions,
): Promise<BrowserGithubPublishResult> {
  const fetcher = options.fetcher ?? fetch;
  const release = await getOrCreateGithubRelease(releasePackage, { ...options, fetcher });
  const uploadedAssets: string[] = [];

  for (const file of releasePackage.files) {
    const name = uploadAssetName(releasePackage, file);
    const response = await fetcher(uploadUrl(release.upload_url, name), {
      method: "POST",
      headers: {
        ...githubApiHeaders(options.token),
        "Content-Type": file.contentType,
      },
      body: file.body,
    });
    await githubJson(response, `Upload GitHub release asset ${name}`);
    uploadedAssets.push(name);
  }

  return {
    releaseId: release.id,
    uploadedAssets,
  };
}
