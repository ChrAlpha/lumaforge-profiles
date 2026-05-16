import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { Shell } from "./components/Shell";
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

function promptText(message: string, fallback = ""): string {
  return window.prompt(message, fallback)?.trim() ?? "";
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

export function App() {
  const [workspace, dispatch] = useReducer(
    workspaceReducer,
    undefined,
    loadPersistedWorkspace,
  );
  const [status, setStatus] = useState("Ready");

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
    const url = promptText("S3/R2 channel or release catalog URL");
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
    setStatus(`Loaded ${entries.length} baseline entries.`);
  }, []);

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
        const namespace = promptText("Namespace for generated ids", "local");
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
        setStatus(`Imported ${files.length} LUT file(s).`);
      })();
    });
    input.click();
  }, [workspace]);

  const buildPlan = useCallback(() => {
    const tag = promptText(
      "Release tag",
      `v${new Date().toISOString().slice(0, 10).replaceAll("-", ".")}`,
    );
    const publicBaseUrl = promptText(
      "Public base URL",
      "https://profiles.example.com",
    );
    if (!tag || !publicBaseUrl) {
      return;
    }
    const plan = buildBrowserS3ReleasePlan(reviewedWorkspace(workspace), {
      tag,
      publicBaseUrl,
      channels: ["stable"],
      generatedAt: new Date().toISOString(),
    });
    setStatus(
      `Built S3/R2 plan with ${plan.catalog.entries.length} entries and ${plan.objects.length} objects.`,
    );
  }, [workspace]);

  const exportWorkspace = useCallback(() => {
    const tag = promptText(
      "Release tag",
      `v${new Date().toISOString().slice(0, 10).replaceAll("-", ".")}`,
    );
    const publicBaseUrl = promptText(
      "Public base URL",
      "https://profiles.example.com",
    );
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
    setStatus(
      `Exported release package with ${releasePackage.files.length} files. Credentials were not included.`,
    );
  }, [workspace]);

  const releasePackageFromPrompts = useCallback(() => {
    const tag = promptText(
      "Release tag",
      `v${new Date().toISOString().slice(0, 10).replaceAll("-", ".")}`,
    );
    const publicBaseUrl = promptText(
      "Public base URL",
      "https://profiles.example.com",
    );
    if (!tag || !publicBaseUrl) {
      return null;
    }
    return buildBrowserReleasePackage(reviewedWorkspace(workspace), {
      tag,
      publicBaseUrl,
      channels: ["stable"],
      generatedAt: new Date().toISOString(),
    });
  }, [workspace]);

  const publishS3 = useCallback(async () => {
    const releasePackage = releasePackageFromPrompts();
    if (!releasePackage) {
      return;
    }
    const bucket = promptText("S3/R2 bucket");
    const region = promptText("S3 region", "auto");
    const endpoint = promptText("S3/R2 endpoint URL");
    const accessKeyId =
      s3AccessKeyIdRef.current || promptText("S3/R2 access key id");
    const secretAccessKey = promptText("S3/R2 secret access key");
    if (!bucket || !accessKeyId || !secretAccessKey) {
      setStatus(
        "S3/R2 publish cancelled: bucket and memory-only credentials are required.",
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
    setStatus(
      `Published S3/R2 release: uploaded ${result.uploaded.length}, skipped ${result.skipped.length}.`,
    );
  }, [releasePackageFromPrompts]);

  const publishGithub = useCallback(async () => {
    const releasePackage = releasePackageFromPrompts();
    if (!releasePackage) {
      return;
    }
    const owner = promptText("GitHub owner/org");
    const repo = promptText("GitHub repository");
    const token = githubTokenRef.current || promptText("GitHub token");
    if (!owner || !repo || !token) {
      setStatus(
        "GitHub publish cancelled: owner, repo, and memory-only token are required.",
      );
      return;
    }
    const result = await publishBrowserGithubRelease(releasePackage, {
      owner,
      repo,
      token,
    });
    setStatus(
      `Published GitHub Release ${releasePackage.tag}: uploaded ${result.uploadedAssets.length} assets.`,
    );
  }, [releasePackageFromPrompts]);

  return (
    <Shell
      workspace={workspace}
      status={status}
      s3AccessKeyId={s3AccessKeyId}
      githubToken={githubToken}
      onS3AccessKeyIdChange={setS3AccessKeyId}
      onGithubTokenChange={setGithubToken}
      onLoadBaseline={() => {
        void loadBaselineFromUrl();
      }}
      onUploadLuts={uploadLuts}
      onBuildS3Plan={buildPlan}
      onExportRelease={exportWorkspace}
      onPublishS3={() => {
        void publishS3();
      }}
      onPublishGithub={() => {
        void publishGithub();
      }}
    />
  );
}
