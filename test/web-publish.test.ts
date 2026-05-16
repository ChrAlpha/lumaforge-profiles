import { describe, expect, test } from "vitest";

import {
  publishBrowserGithubRelease,
  publishBrowserS3ReleasePackage,
  type BrowserS3PublishTransport,
} from "../src/web/publish";
import type { BrowserReleasePackage } from "../src/web/release";

function releasePackage(): BrowserReleasePackage {
  return {
    schemaVersion: 1,
    tag: "v2026.05.16",
    generatedAt: "2026-05-16T02:00:00.000Z",
    files: [
      {
        path: "catalog.json",
        contentType: "application/json",
        body: '{"entries":[]}',
      },
      {
        path: "release.json",
        contentType: "application/json",
        body: '{"tag":"v2026.05.16"}',
      },
      {
        path: "blobs-manifest.json",
        contentType: "application/json",
        body: '{"blobs":[]}',
      },
      {
        path: "publish-plan.json",
        contentType: "application/json",
        body: JSON.stringify({
          schemaVersion: 1,
          tag: "v2026.05.16",
          generatedAt: "2026-05-16T02:00:00.000Z",
          publicBaseUrl: "https://profiles.example.test",
          channelNames: ["stable"],
          objects: [
            {
              phase: "blob",
              key: "blobs/sha256/aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.cube",
              url: "https://profiles.example.test/blobs/sha256/aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.cube",
              localPath: "blobs/sha256/aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.cube",
              contentType: "application/x-cube-lut",
              cacheControl: "public, max-age=31536000, immutable",
              size: 34,
              action: "check-remote",
            },
            {
              phase: "release-catalog",
              key: "releases/v2026.05.16/catalog.json",
              url: "https://profiles.example.test/releases/v2026.05.16/catalog.json",
              localPath: "catalog.json",
              contentType: "application/json",
              cacheControl: "public, max-age=86400, immutable",
              size: 14,
              action: "upload",
            },
            {
              phase: "release-metadata",
              key: "releases/v2026.05.16/release.json",
              url: "https://profiles.example.test/releases/v2026.05.16/release.json",
              localPath: "release.json",
              contentType: "application/json",
              cacheControl: "public, max-age=86400, immutable",
              size: 22,
              action: "upload",
            },
            {
              phase: "channel",
              key: "channels/stable/catalog.json",
              url: "https://profiles.example.test/channels/stable/catalog.json",
              localPath: "catalog.json",
              contentType: "application/json",
              cacheControl: "public, max-age=60, stale-while-revalidate=600",
              size: 14,
              action: "upload",
            },
            {
              phase: "channel",
              key: "channels/stable/release.json",
              url: "https://profiles.example.test/channels/stable/release.json",
              localPath: "release.json",
              contentType: "application/json",
              cacheControl: "public, max-age=60, stale-while-revalidate=600",
              size: 22,
              action: "upload",
            },
          ],
        }),
      },
      {
        path: "blobs/sha256/aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.cube",
        contentType: "application/x-cube-lut",
        body: 'TITLE "Existing"\n',
      },
    ],
  };
}

describe("browser publishing API integration", () => {
  test("publishes S3 release package by skipping existing blobs and uploading channel pointers last", async () => {
    const calls: string[] = [];
    const transport: BrowserS3PublishTransport = {
      async headObject(key) {
        calls.push(`head:${key}`);
        return key.startsWith("blobs/");
      },
      async putObject(input) {
        calls.push(`put:${input.key}:${input.cacheControl}`);
      },
    };

    const result = await publishBrowserS3ReleasePackage(releasePackage(), {
      bucket: "profiles",
      transport,
      credentials: {
        accessKeyId: "AKIA_SHOULD_NOT_LEAK",
        secretAccessKey: "SECRET_SHOULD_NOT_LEAK",
      },
    });

    expect(calls).toEqual([
      "head:blobs/sha256/aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.cube",
      "put:releases/v2026.05.16/catalog.json:public, max-age=86400, immutable",
      "put:releases/v2026.05.16/release.json:public, max-age=86400, immutable",
      "put:channels/stable/catalog.json:public, max-age=60, stale-while-revalidate=600",
      "put:channels/stable/release.json:public, max-age=60, stale-while-revalidate=600",
    ]);
    expect(result.skipped).toEqual([
      "blobs/sha256/aa/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.cube",
    ]);
    expect(JSON.stringify(result)).not.toContain("AKIA_SHOULD_NOT_LEAK");
    expect(JSON.stringify(result)).not.toContain("SECRET_SHOULD_NOT_LEAK");
  });

  test("publishes GitHub release assets using memory token without returning the token", async () => {
    const requests: Array<{ url: string; method: string; body?: unknown }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requests.push({ url, method, body: init?.body });
      if (method === "GET" && url.endsWith("/releases/tags/v2026.05.16")) {
        return new Response(JSON.stringify({ id: 123, upload_url: "https://uploads.github.test/repos/acme/profiles/releases/123/assets{?name,label}" }), { status: 200 });
      }
      if (method === "POST" && url.startsWith("https://uploads.github.test/")) {
        return new Response(JSON.stringify({ id: 456, name: new URL(url).searchParams.get("name") }), { status: 201 });
      }
      return new Response("unexpected", { status: 500 });
    };

    const result = await publishBrowserGithubRelease(releasePackage(), {
      owner: "acme",
      repo: "profiles",
      token: "ghp_SHOULD_NOT_LEAK",
      fetcher,
    });

    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      "GET https://api.github.com/repos/acme/profiles/releases/tags/v2026.05.16",
      "POST https://uploads.github.test/repos/acme/profiles/releases/123/assets?name=lumaforge-profiles.v2026.05.16.catalog.json",
      "POST https://uploads.github.test/repos/acme/profiles/releases/123/assets?name=lumaforge-profiles.v2026.05.16.release.json",
      "POST https://uploads.github.test/repos/acme/profiles/releases/123/assets?name=lumaforge-profiles.v2026.05.16.blobs-manifest.json",
      "POST https://uploads.github.test/repos/acme/profiles/releases/123/assets?name=lumaforge-profiles.v2026.05.16.publish-plan.json",
      "POST https://uploads.github.test/repos/acme/profiles/releases/123/assets?name=lumaforge-profiles.v2026.05.16.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.cube",
    ]);
    expect(result.uploadedAssets).toHaveLength(5);
    expect(JSON.stringify(result)).not.toContain("ghp_SHOULD_NOT_LEAK");
  });
});
