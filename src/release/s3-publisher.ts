import {
  joinPublicUrl,
  cacheControlForObjectKey,
  type BuildS3ReleaseResult,
  type S3ReleaseObject,
} from "./s3-shared";
import type { ObjectStore } from "./object-store";
import type { ProfilesPublisher } from "./publisher";
import { loadPublishedS3ChannelPointer } from "./s3-registry";

export interface S3PublishOptions {
  build: BuildS3ReleaseResult;
  channelNames?: string[];
  dryRun?: boolean;
}

export interface S3PublishPlanObject extends S3ReleaseObject {
  action: "skip" | "upload" | "update";
}

export interface S3PublishPlan {
  tag: string;
  bucket: string;
  publicBaseUrl: string;
  dryRun: boolean;
  objects: S3PublishPlanObject[];
  channelUpdates: Array<{
    channel: string;
    previousTag: string | null;
    nextTag: string;
  }>;
  estimatedClassAOperations: number;
  estimatedClassBOperations: number;
}

export interface S3PublishResult extends S3PublishPlan {
  uploadedBlobCount: number;
  skippedBlobCount: number;
}

export interface S3PublisherOptions {
  bucket: string;
  publicBaseUrl: string;
  store: Pick<ObjectStore, "headObject" | "putObject" | "getJson">;
}

export class S3Publisher implements ProfilesPublisher<
  S3PublishPlan,
  S3PublishResult,
  S3PublishOptions
> {
  constructor(private readonly options: S3PublisherOptions) {}

  private channelObjects(build: BuildS3ReleaseResult, channelNames: string[]) {
    const uniqueChannels = [
      ...new Set(channelNames.map((value) => value.trim()).filter(Boolean)),
    ];
    const objects: S3ReleaseObject[] = [];
    const updates = uniqueChannels.map((channel) => ({
      channel,
      previousTag: null as string | null,
      nextTag: build.release.tag,
    }));
    for (const update of updates) {
      const channel = update.channel;
      const catalogKey = `channels/${channel}/catalog.json`;
      const releaseKey = `channels/${channel}/release.json`;
      objects.push(
        {
          phase: "channel",
          key: catalogKey,
          url: joinPublicUrl(this.options.publicBaseUrl, catalogKey),
          localPath: build.catalogPath,
          contentType: "application/json",
          cacheControl: cacheControlForObjectKey(catalogKey),
          size:
            build.objects.find(
              (object) =>
                object.key === `releases/${build.release.tag}/catalog.json`,
            )?.size ?? 0,
        },
        {
          phase: "channel",
          key: releaseKey,
          url: joinPublicUrl(this.options.publicBaseUrl, releaseKey),
          localPath: build.releasePath,
          contentType: "application/json",
          cacheControl: cacheControlForObjectKey(releaseKey),
          size:
            build.objects.find(
              (object) =>
                object.key === `releases/${build.release.tag}/release.json`,
            )?.size ?? 0,
        },
      );
    }
    return {
      objects,
      updates,
    };
  }

  async plan(options: S3PublishOptions): Promise<S3PublishPlan> {
    const channelState = this.channelObjects(
      options.build,
      options.channelNames ?? [],
    );
    const objects: S3PublishPlanObject[] = [];
    let classBOperations = 0;
    for (const update of channelState.updates) {
      const current = await loadPublishedS3ChannelPointer(this.options.store, {
        channel: update.channel,
      });
      update.previousTag = current?.tag ?? null;
      classBOperations += 1;
    }

    for (const object of [...options.build.objects, ...channelState.objects]) {
      if (object.phase === "blob") {
        classBOperations += 1;
        const exists = await this.options.store.headObject(object.key);
        objects.push({
          ...object,
          action: exists ? "skip" : "upload",
        });
        continue;
      }

      objects.push({
        ...object,
        action: object.phase === "channel" ? "update" : "upload",
      });
    }

    return {
      tag: options.build.release.tag,
      bucket: this.options.bucket,
      publicBaseUrl: this.options.publicBaseUrl,
      dryRun: options.dryRun ?? true,
      objects,
      channelUpdates: channelState.updates,
      estimatedClassAOperations: objects.filter(
        (object) => object.action !== "skip",
      ).length,
      estimatedClassBOperations: classBOperations,
    };
  }

  async publish(
    options: S3PublishOptions & { dryRun: boolean },
  ): Promise<S3PublishResult> {
    const plan = await this.plan(options);
    if (!options.dryRun) {
      for (const object of plan.objects) {
        if (object.action === "skip") {
          continue;
        }
        await this.options.store.putObject({
          key: object.key,
          bodyPath: object.localPath,
          contentType: object.contentType,
          cacheControl: object.cacheControl,
        });
      }
    }

    return {
      ...plan,
      dryRun: options.dryRun,
      uploadedBlobCount: plan.objects.filter(
        (object) => object.phase === "blob" && object.action === "upload",
      ).length,
      skippedBlobCount: plan.objects.filter(
        (object) => object.phase === "blob" && object.action === "skip",
      ).length,
    };
  }
}
