import type { ObjectStore } from "./object-store";
import {
  releaseEntryKey,
  type BlobsManifestDocument,
  type ReleaseCatalog,
  type ReleaseEntryDocument,
  type ReleaseMetadataDocument,
} from "./s3-shared";

type RegistryStore = Pick<ObjectStore, "getJson">;

export interface PublishedS3ChannelPointer {
  channel: string;
  tag: string;
  release: ReleaseMetadataDocument;
}

export interface PublishedS3ChannelState {
  channel: string;
  tag: string;
  release: ReleaseMetadataDocument;
  catalog: ReleaseCatalog;
}

export interface PublishedS3ReleaseState {
  tag: string;
  release: ReleaseMetadataDocument;
  catalog: ReleaseCatalog;
  blobsManifest: BlobsManifestDocument;
  entries: ReleaseEntryDocument[];
}

export async function loadPublishedS3ChannelPointer(
  store: RegistryStore,
  options: { channel: string },
): Promise<PublishedS3ChannelPointer | null> {
  const release = await store.getJson<ReleaseMetadataDocument>(
    `channels/${options.channel}/release.json`,
  );
  if (!release) {
    return null;
  }
  return {
    channel: options.channel,
    tag: release.tag,
    release,
  };
}

export async function loadPublishedS3Channel(
  store: RegistryStore,
  options: { channel: string },
): Promise<PublishedS3ChannelState | null> {
  const pointer = await loadPublishedS3ChannelPointer(store, options);
  if (!pointer) {
    return null;
  }
  const catalog = await store.getJson<ReleaseCatalog>(
    `channels/${options.channel}/catalog.json`,
  );
  if (!catalog) {
    throw new Error(
      `Published channel ${options.channel} is missing channels/${options.channel}/catalog.json.`,
    );
  }
  return {
    channel: options.channel,
    tag: pointer.tag,
    release: pointer.release,
    catalog,
  };
}

export async function loadPublishedS3Entry(
  store: RegistryStore,
  options: { tag: string; entryId: string },
): Promise<ReleaseEntryDocument | null> {
  return store.getJson<ReleaseEntryDocument>(
    releaseEntryKey(options.tag, options.entryId),
  );
}

export async function loadPublishedS3Release(
  store: RegistryStore,
  options: { tag: string; includeEntries?: boolean },
): Promise<PublishedS3ReleaseState | null> {
  const release = await store.getJson<ReleaseMetadataDocument>(
    `releases/${options.tag}/release.json`,
  );
  if (!release) {
    return null;
  }
  const catalog = await store.getJson<ReleaseCatalog>(
    `releases/${options.tag}/catalog.json`,
  );
  if (!catalog) {
    throw new Error(
      `Published release ${options.tag} is missing releases/${options.tag}/catalog.json.`,
    );
  }
  const blobsManifest = await store.getJson<BlobsManifestDocument>(
    `releases/${options.tag}/blobs-manifest.json`,
  );
  if (!blobsManifest) {
    throw new Error(
      `Published release ${options.tag} is missing releases/${options.tag}/blobs-manifest.json.`,
    );
  }

  const entries: ReleaseEntryDocument[] = [];
  if (options.includeEntries) {
    for (const entry of catalog.entries) {
      const loaded = await loadPublishedS3Entry(store, {
        tag: options.tag,
        entryId: entry.id,
      });
      if (!loaded) {
        throw new Error(
          `Published release ${options.tag} is missing ${releaseEntryKey(options.tag, entry.id)}.`,
        );
      }
      entries.push(loaded);
    }
  }

  return {
    tag: options.tag,
    release,
    catalog,
    blobsManifest,
    entries,
  };
}
