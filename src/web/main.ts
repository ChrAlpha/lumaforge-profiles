import "./styles.css";

import { buildBrowserReleasePackage, buildBrowserS3ReleasePlan } from "./release";
import { renderWorkspaceShell } from "./ui";
import {
  addLutUploadBatch,
  createWebProfilesWorkspace,
  exportPersistableWorkspace,
  restorePersistedWorkspace,
  type PersistedWebWorkspace,
  type WebProfilesWorkspace,
  type WebWorkspaceEntry,
} from "./workspace";

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

let workspace = loadPersistedWorkspace();
const secrets = {
  s3AccessKeyId: "",
  s3SecretAccessKey: "",
  githubToken: "",
};

function appRoot() {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root.");
  }
  return root;
}

function loadPersistedWorkspace() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createWebProfilesWorkspace({ now: new Date().toISOString() });
  }
  try {
    return restorePersistedWorkspace(JSON.parse(raw) as PersistedWebWorkspace);
  } catch {
    return createWebProfilesWorkspace({ now: new Date().toISOString() });
  }
}

function persistWorkspace() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(exportPersistableWorkspace(workspace, { includeDraftFileText: true })),
  );
}

function setStatus(message: string) {
  const status = document.querySelector<HTMLElement>("[data-status]");
  if (status) {
    status.textContent = message;
  }
}

function render() {
  appRoot().innerHTML = `${renderWorkspaceShell(workspace)}<div class="status-line" data-status>Ready</div>`;
  wireActions();
}

function promptText(message: string, fallback = "") {
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

async function uploadLuts() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".cube";
  input.multiple = true;
  input.addEventListener("change", async () => {
    if (!input.files || input.files.length === 0) {
      return;
    }
    const namespace = promptText("Namespace for generated ids", "local");
    if (!namespace) {
      return;
    }
    const files = await readFiles(input.files);
    workspace = await addLutUploadBatch(workspace, {
      batchName: `Upload ${workspace.batches.length + 1}`,
      namespace,
      files,
      now: new Date().toISOString(),
    });
    persistWorkspace();
    render();
    setStatus(`Imported ${files.length} LUT file(s).`);
  });
  input.click();
}

function carriedEntryFromReleaseDocument(document: ReleaseEntryDocument): WebWorkspaceEntry {
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

async function loadBaselineFromUrl() {
  const url = promptText("S3/R2 channel or release catalog URL");
  if (!url) {
    return;
  }
  const catalog = (await fetch(url).then((response) => response.json())) as ReleaseCatalog;
  const entries = await Promise.all(
    catalog.entries.map(async (entry) =>
      carriedEntryFromReleaseDocument(
        (await fetch(entry.entryUrl).then((response) => response.json())) as ReleaseEntryDocument,
      ),
    ),
  );
  workspace = createWebProfilesWorkspace({
    baselineEntries: entries,
    now: new Date().toISOString(),
  });
  persistWorkspace();
  render();
  setStatus(`Loaded ${entries.length} baseline entries.`);
}

function reviewedWorkspace(): WebProfilesWorkspace {
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

function buildPlan() {
  const tag = promptText("Release tag", `v${new Date().toISOString().slice(0, 10).replaceAll("-", ".")}`);
  const publicBaseUrl = promptText("Public base URL", "https://profiles.example.com");
  if (!tag || !publicBaseUrl) {
    return;
  }
  const plan = buildBrowserS3ReleasePlan(reviewedWorkspace(), {
    tag,
    publicBaseUrl,
    channels: ["stable"],
    generatedAt: new Date().toISOString(),
  });
  setStatus(`Built S3/R2 plan with ${plan.catalog.entries.length} entries and ${plan.objects.length} objects.`);
}

function exportWorkspace() {
  const tag = promptText("Release tag", `v${new Date().toISOString().slice(0, 10).replaceAll("-", ".")}`);
  const publicBaseUrl = promptText("Public base URL", "https://profiles.example.com");
  if (!tag || !publicBaseUrl) {
    return;
  }
  const releasePackage = buildBrowserReleasePackage(reviewedWorkspace(), {
    tag,
    publicBaseUrl,
    channels: ["stable"],
    generatedAt: new Date().toISOString(),
  });
  const blob = new Blob(
    [JSON.stringify(releasePackage, null, 2)],
    { type: "application/json" },
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `lumaforge-profiles.${tag}.release-package.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  setStatus(`Exported release package with ${releasePackage.files.length} files. Credentials were not included.`);
}

function captureSecrets() {
  secrets.s3AccessKeyId =
    document.querySelector<HTMLInputElement>('[data-secret="s3-access-key"]')?.value ?? "";
  secrets.githubToken =
    document.querySelector<HTMLInputElement>('[data-secret="github-token"]')?.value ?? "";
}

function publishPlaceholder(kind: "S3/R2" | "GitHub Release") {
  captureSecrets();
  setStatus(`${kind} publish is ready for API integration. Entered credentials remain in memory only.`);
}

function wireActions() {
  document.querySelector('[data-action="load-baseline"]')?.addEventListener("click", () => {
    void loadBaselineFromUrl();
  });
  document.querySelector('[data-action="upload-luts"]')?.addEventListener("click", () => {
    void uploadLuts();
  });
  document.querySelector('[data-action="build-s3"]')?.addEventListener("click", buildPlan);
  document.querySelector('[data-action="export-release"]')?.addEventListener("click", exportWorkspace);
  document.querySelector('[data-action="publish-s3"]')?.addEventListener("click", () => publishPlaceholder("S3/R2"));
  document.querySelector('[data-action="publish-github"]')?.addEventListener("click", () =>
    publishPlaceholder("GitHub Release"),
  );
}

render();
