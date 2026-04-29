import {
  joinPublicUrl,
  cacheControlForObjectKey,
  type BuildR2ReleaseResult,
  type R2ReleaseObject,
} from "./r2-shared";
import type { ObjectStore } from "./object-store";
import type { ProfilesPublisher } from "./publisher";
import { loadPublishedR2ChannelPointer } from "./r2-registry";

export interface R2PublishOptions {
  build: BuildR2ReleaseResult;
  channelNames?: string[];
  dryRun?: boolean;
}

export interface R2PublishPlanObject extends R2ReleaseObject {
  action: "skip" | "upload" | "update";
}

export interface R2PublishPlan {
  tag: string;
  bucket: string;
  publicBaseUrl: string;
  dryRun: boolean;
  objects: R2PublishPlanObject[];
  channelUpdates: Array<{
    channel: string;
    previousTag: string | null;
    nextTag: string;
  }>;
  estimatedClassAOperations: number;
  estimatedClassBOperations: number;
}

export interface R2PublishResult extends R2PublishPlan {
  uploadedBlobCount: number;
  skippedBlobCount: number;
}

export interface R2PublisherOptions {
  bucket: string;
  publicBaseUrl: string;
  store: Pick<ObjectStore, "headObject" | "putObject" | "getJson">;
}

export class R2Publisher implements ProfilesPublisher<
  R2PublishPlan,
  R2PublishResult,
  R2PublishOptions
> {
  constructor(private readonly options: R2PublisherOptions) {}

  private channelObjects(build: BuildR2ReleaseResult, channelNames: string[]) {
    const uniqueChannels = [
      ...new Set(channelNames.map((value) => value.trim()).filter(Boolean)),
    ];
    const objects: R2ReleaseObject[] = [];
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

  async plan(options: R2PublishOptions): Promise<R2PublishPlan> {
    const channelState = this.channelObjects(
      options.build,
      options.channelNames ?? [],
    );
    const objects: R2PublishPlanObject[] = [];
    let classBOperations = 0;
    for (const update of channelState.updates) {
      const current = await loadPublishedR2ChannelPointer(this.options.store, {
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
    options: R2PublishOptions & { dryRun: boolean },
  ): Promise<R2PublishResult> {
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
