import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { Shell } from "./components/Shell";
import { StatusToastProvider, useStatusToast } from "./components/StatusToast";
import { usePromptDialog } from "./components/usePromptDialog";
import {
  initialWorkspaceState,
  workspaceReducer,
} from "./workspace-reducer";
import { publishBrowserGithubRelease, publishBrowserS3ReleasePackage } from "../publish";
import { buildBrowserReleasePackage, buildBrowserS3ReleasePlan } from "../release";
import {
  addLutUploadBatch,
  exportPersistableWorkspace,
  restorePersistedWorkspace,
  type PersistedWebWorkspace,
  type WebProfilesWorkspace,
  type WebWorkspaceEntry,
} from "../workspace";

const STORAGE_KEY = "lumaforge-profiles-workspace-v1";

interface ReleaseEntryDocument {
  id: string;
  kind: "lut";
  format: "cube";
  version: string;
  title: string;
  description: string | null;
  license: string;
  author: string;
  source: string;
  sourceUrl: string | null;
  redistributionAllowed: true;
  targets: Record<string, unknown>;
  assets: Array<{
    role: string;
    mediaType: string;
    originalPath: string;
    size: number;
    sha256: string;
  }>;
  createdAt: string;
  updatedAt: string;
  lut?: WebWorkspaceEntry["manifest"]["lut"];
}

interface ReleaseCatalog {
  entries: Array<{
    id: string;
    title: string;
    entryUrl: string;
  }>;
}

function loadPersistedWorkspace(): WebProfilesWorkspace {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return initialWorkspaceState(new Date().toISOString());
  }
  try {
    return restorePersistedWorkspace(JSON.parse(raw) as PersistedWebWorkspace);
  } catch {
    return initialWorkspaceState(new Date().toISOString());
  }
}

function releaseDefaults(): { tag: string; publicBaseUrl: string } {
  return {
    tag: `v${new Date().toISOString().slice(0, 10).replaceAll("-", ".")}`,
    publicBaseUrl: "https://profiles.example.com",
  };
}

async function readFiles(files: FileList | File[]) {
  return Promise.all(
    Array.from(files).map(async (file) => ({
      name: file.name,
      text: await file.text(),
    })),
  );
}

function carriedEntryFromReleaseDocument(
  document: ReleaseEntryDocument,
): WebWorkspaceEntry {
  return {
    id: document.id,
    status: "carried",
    manifest: {
      schemaVersion: 1,
      id: document.id,
      kind: document.kind,
      format: document.format,
      version: document.version,
      title: document.title,
      description: document.description,
      license: document.license,
      author: document.author,
      source: document.source,
      sourceUrl: document.sourceUrl,
      redistributionAllowed: document.redistributionAllowed,
      targets: document.targets,
      assets: document.assets.map((asset) => ({
        role: asset.role,
        path: asset.originalPath,
        mediaType: asset.mediaType,
        byteSize: asset.size,
        sha256: asset.sha256,
      })),
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      ...(document.lut ? { lut: document.lut } : {}),
    },
    review: { reviewed: true, warnings: [] },
  };
}

function reviewedWorkspace(
  workspace: WebProfilesWorkspace,
): WebProfilesWorkspace {
  return {
    ...workspace,
    entries: workspace.entries.map((entry) =>
      entry.status === "new-draft"
        ? {
            ...entry,
            manifest: {
              ...entry.manifest,
              redistributionAllowed: true,
              lut: {
                ...entry.manifest.lut,
                inputTransfer: entry.manifest.lut?.inputTransfer ?? "srgb",
                inputGamut: entry.manifest.lut?.inputGamut ?? "rec709",
                outputTransfer: entry.manifest.lut?.outputTransfer ?? "srgb",
                outputGamut: entry.manifest.lut?.outputGamut ?? "rec709",
                intent: entry.manifest.lut?.intent ?? "display-look",
              },
            },
            review: { reviewed: true, warnings: [] },
          }
        : entry,
    ),
  };
}

function StudioApp() {
  const [workspace, dispatch] = useReducer(
    workspaceReducer,
    undefined,
    loadPersistedWorkspace,
  );
  const { notify } = useStatusToast();
  const { prompt, dialog } = usePromptDialog();

  // Credentials/secrets are in-memory only and never persisted, mirroring the
  // legacy `secrets`/`captureSecrets` behaviour.
  const [s3AccessKeyId, setS3AccessKeyId] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const s3AccessKeyIdRef = useRef(s3AccessKeyId);
  const githubTokenRef = useRef(githubToken);
  s3AccessKeyIdRef.current = s3AccessKeyId;
  githubTokenRef.current = githubToken;

  // A simple "skip the first effect" mount counter is unsafe here: main.tsx
  // wraps <App/> in <StrictMode>, and React double-invokes effects on mount
  // (setup -> cleanup -> setup) WITHOUT recreating refs. A boolean/counter
  // guard would skip run 1 but let run 2 write the untouched boot workspace to
  // localStorage, clobbering persisted storage before the user does anything.
  // Instead we compare serialized snapshots: we never write while the
  // workspace still equals the value it booted with, and we de-dupe repeat
  // writes of an identical value (so StrictMode's post-change double-fire
  // persists at most once). Writes only happen once a reducer action has
  // actually changed the persistable workspace.
  const bootSnapshotRef = useRef<string | null>(null);
  if (bootSnapshotRef.current === null) {
    bootSnapshotRef.current = JSON.stringify(
      exportPersistableWorkspace(workspace, { includeDraftFileText: true }),
    );
  }
  const lastWrittenRef = useRef<string>(bootSnapshotRef.current);
  useEffect(() => {
    const serialized = JSON.stringify(
      exportPersistableWorkspace(workspace, { includeDraftFileText: true }),
    );
    if (
      serialized === bootSnapshotRef.current ||
      serialized === lastWrittenRef.current
    ) {
      return;
    }
    lastWrittenRef.current = serialized;
    localStorage.setItem(STORAGE_KEY, serialized);
  }, [workspace]);

  const loadBaselineFromUrl = useCallback(async () => {
    const values = await prompt({
      title: "Load baseline",
      fields: [
        { name: "url", label: "S3/R2 channel or release catalog URL" },
      ],
    });
    const url = values?.url ?? "";
    if (!url) {
      return;
    }
    const catalog = (await fetch(url).then((response) =>
      response.json(),
    )) as ReleaseCatalog;
    const entries = await Promise.all(
      catalog.entries.map(async (entry) =>
        carriedEntryFromReleaseDocument(
          (await fetch(entry.entryUrl).then((response) =>
            response.json(),
          )) as ReleaseEntryDocument,
        ),
      ),
    );
    dispatch({
      type: "load-baseline",
      baselineEntries: entries,
      now: new Date().toISOString(),
    });
    notify(`Loaded ${entries.length} baseline entries.`, "success");
  }, [prompt, notify]);

  const uploadLuts = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".cube";
    input.multiple = true;
    input.addEventListener("change", () => {
      void (async () => {
        if (!input.files || input.files.length === 0) {
          return;
        }
        const values = await prompt({
          title: "Upload LUTs",
          fields: [
            {
              name: "namespace",
              label: "Namespace for generated ids",
              defaultValue: "local",
            },
          ],
        });
        const namespace = values?.namespace ?? "";
        if (!namespace) {
          return;
        }
        const files = await readFiles(input.files);
        const next = await addLutUploadBatch(workspace, {
          batchName: `Upload ${workspace.batches.length + 1}`,
          namespace,
          files,
          now: new Date().toISOString(),
        });
        dispatch({ type: "set-workspace", workspace: next });
        notify(`Imported ${files.length} LUT file(s).`, "success");
      })();
    });
    input.click();
  }, [workspace, prompt, notify]);

  const buildPlan = useCallback(async () => {
    const defaults = releaseDefaults();
    const values = await prompt({
      title: "Build S3/R2 plan",
      fields: [
        { name: "tag", label: "Release tag", defaultValue: defaults.tag },
        {
          name: "publicBaseUrl",
          label: "Public base URL",
          defaultValue: defaults.publicBaseUrl,
        },
      ],
    });
    const tag = values?.tag ?? "";
    const publicBaseUrl = values?.publicBaseUrl ?? "";
    if (!tag || !publicBaseUrl) {
      return;
    }
    const plan = buildBrowserS3ReleasePlan(reviewedWorkspace(workspace), {
      tag,
      publicBaseUrl,
      channels: ["stable"],
      generatedAt: new Date().toISOString(),
    });
    notify(
      `Built S3/R2 plan with ${plan.catalog.entries.length} entries and ${plan.objects.length} objects.`,
      "success",
    );
  }, [workspace, prompt, notify]);

  const exportWorkspace = useCallback(async () => {
    const defaults = releaseDefaults();
    const values = await prompt({
      title: "Export release package",
      fields: [
        { name: "tag", label: "Release tag", defaultValue: defaults.tag },
        {
          name: "publicBaseUrl",
          label: "Public base URL",
          defaultValue: defaults.publicBaseUrl,
        },
      ],
    });
    const tag = values?.tag ?? "";
    const publicBaseUrl = values?.publicBaseUrl ?? "";
    if (!tag || !publicBaseUrl) {
      return;
    }
    const releasePackage = buildBrowserReleasePackage(
      reviewedWorkspace(workspace),
      {
        tag,
        publicBaseUrl,
        channels: ["stable"],
        generatedAt: new Date().toISOString(),
      },
    );
    const blob = new Blob([JSON.stringify(releasePackage, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `lumaforge-profiles.${tag}.release-package.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    notify(
      `Exported release package with ${releasePackage.files.length} files. Credentials were not included.`,
      "success",
    );
  }, [workspace, prompt, notify]);

  const releasePackageFromPrompts = useCallback(async () => {
    const defaults = releaseDefaults();
    const values = await prompt({
      title: "Release package details",
      fields: [
        { name: "tag", label: "Release tag", defaultValue: defaults.tag },
        {
          name: "publicBaseUrl",
          label: "Public base URL",
          defaultValue: defaults.publicBaseUrl,
        },
      ],
    });
    const tag = values?.tag ?? "";
    const publicBaseUrl = values?.publicBaseUrl ?? "";
    if (!tag || !publicBaseUrl) {
      return null;
    }
    return buildBrowserReleasePackage(reviewedWorkspace(workspace), {
      tag,
      publicBaseUrl,
      channels: ["stable"],
      generatedAt: new Date().toISOString(),
    });
  }, [workspace, prompt]);

  const publishS3 = useCallback(async () => {
    const releasePackage = await releasePackageFromPrompts();
    if (!releasePackage) {
      return;
    }
    const hasAccessKeyRef = Boolean(s3AccessKeyIdRef.current);
    const values = await prompt({
      title: "Publish to S3/R2",
      fields: [
        { name: "bucket", label: "S3/R2 bucket" },
        {
          name: "region",
          label: "S3 region",
          defaultValue: "auto",
          required: false,
        },
        {
          name: "endpoint",
          label: "S3/R2 endpoint URL",
          required: false,
        },
        ...(hasAccessKeyRef
          ? []
          : [{ name: "accessKeyId", label: "S3/R2 access key id" }]),
        { name: "secretAccessKey", label: "S3/R2 secret access key" },
      ],
    });
    const bucket = values?.bucket ?? "";
    const region = values?.region ?? "";
    const endpoint = values?.endpoint ?? "";
    const accessKeyId = s3AccessKeyIdRef.current || (values?.accessKeyId ?? "");
    const secretAccessKey = values?.secretAccessKey ?? "";
    if (!bucket || !accessKeyId || !secretAccessKey) {
      notify(
        "S3/R2 publish cancelled: bucket and memory-only credentials are required.",
        "error",
      );
      return;
    }
    const result = await publishBrowserS3ReleasePackage(releasePackage, {
      bucket,
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: Boolean(endpoint),
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    notify(
      `Published S3/R2 release: uploaded ${result.uploaded.length}, skipped ${result.skipped.length}.`,
      "success",
    );
  }, [releasePackageFromPrompts, prompt, notify]);

  const publishGithub = useCallback(async () => {
    const releasePackage = await releasePackageFromPrompts();
    if (!releasePackage) {
      return;
    }
    const hasTokenRef = Boolean(githubTokenRef.current);
    const values = await prompt({
      title: "Publish GitHub Release",
      fields: [
        { name: "owner", label: "GitHub owner/org" },
        { name: "repo", label: "GitHub repository" },
        ...(hasTokenRef
          ? []
          : [{ name: "token", label: "GitHub token" }]),
      ],
    });
    const owner = values?.owner ?? "";
    const repo = values?.repo ?? "";
    const token = githubTokenRef.current || (values?.token ?? "");
    if (!owner || !repo || !token) {
      notify(
        "GitHub publish cancelled: owner, repo, and memory-only token are required.",
        "error",
      );
      return;
    }
    const result = await publishBrowserGithubRelease(releasePackage, {
      owner,
      repo,
      token,
    });
    notify(
      `Published GitHub Release ${releasePackage.tag}: uploaded ${result.uploadedAssets.length} assets.`,
      "success",
    );
  }, [releasePackageFromPrompts, prompt, notify]);

  return (
    <>
      <Shell
        workspace={workspace}
        s3AccessKeyId={s3AccessKeyId}
        githubToken={githubToken}
        onS3AccessKeyIdChange={setS3AccessKeyId}
        onGithubTokenChange={setGithubToken}
        onLoadBaseline={() => {
          void loadBaselineFromUrl();
        }}
        onUploadLuts={uploadLuts}
        onBuildS3Plan={() => {
          void buildPlan();
        }}
        onExportRelease={() => {
          void exportWorkspace();
        }}
        onPublishS3={() => {
          void publishS3();
        }}
        onPublishGithub={() => {
          void publishGithub();
        }}
      />
      {dialog}
    </>
  );
}

export function App() {
  return (
    <StatusToastProvider>
      <StudioApp />
    </StatusToastProvider>
  );
}
