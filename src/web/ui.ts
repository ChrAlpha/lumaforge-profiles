import type { WebProfilesWorkspace, WebWorkspaceEntry } from "./workspace";

function escapeHtml(value: unknown) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function entryWarnings(entry: WebWorkspaceEntry) {
  if (entry.review.warnings.length === 0) {
    return "Ready";
  }
  return entry.review.warnings.join(" ");
}

function renderEntryRow(entry: WebWorkspaceEntry) {
  const asset = entry.manifest.assets[0];
  return `
    <tr>
      <td>${escapeHtml(entry.manifest.title)}</td>
      <td>${escapeHtml(entry.status)}</td>
      <td>${escapeHtml(entry.batchId ?? "baseline")}</td>
      <td>${escapeHtml(asset?.sha256.slice(0, 12) ?? "")}</td>
      <td>${escapeHtml(entryWarnings(entry))}</td>
    </tr>
  `;
}

function renderBatchList(workspace: WebProfilesWorkspace) {
  if (workspace.batches.length === 0) {
    return "<li>No upload batches yet</li>";
  }
  return workspace.batches
    .map((batch) => `<li>${escapeHtml(batch.name)} <span>${batch.entryIds.length} LUTs</span></li>`)
    .join("");
}

export function renderWorkspaceShell(workspace: WebProfilesWorkspace) {
  const selected = workspace.entries[0];
  const manifestPreview = selected
    ? JSON.stringify(selected.manifest, null, 2)
    : "{}";

  return `
    <section class="app-shell" aria-label="LumaForge Profiles Studio">
      <aside class="sidebar">
        <h1>LumaForge Profiles Studio</h1>
        <nav>
          <a href="#library">Library</a>
          <a href="#metadata">Metadata</a>
          <a href="#build">Build</a>
          <a href="#publish">Publish</a>
        </nav>
        <p class="security-note">Credentials stay in memory only.</p>
      </aside>
      <main>
        <section id="library" class="panel">
          <header>
            <h2>Library</h2>
            <p>${workspace.entries.length} LUT entries across baseline and uploaded batches.</p>
          </header>
          <div class="actions">
            <button type="button" data-action="load-baseline">Load baseline</button>
            <button type="button" data-action="upload-luts">Upload LUTs</button>
          </div>
          <h3>Upload batches</h3>
          <ul>${renderBatchList(workspace)}</ul>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Batch</th>
                <th>SHA-256</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>${workspace.entries.map(renderEntryRow).join("")}</tbody>
          </table>
        </section>
        <section id="metadata" class="panel">
          <header>
            <h2>Metadata</h2>
            <p>Review generated fields before publishing.</p>
          </header>
          <h3>Manifest preview</h3>
          <pre>${escapeHtml(manifestPreview)}</pre>
        </section>
        <section id="build" class="panel">
          <header>
            <h2>Build</h2>
            <p>Build from carried baseline entries plus reviewed new entries.</p>
          </header>
          <button type="button" data-action="build-s3">Build S3/R2 plan</button>
          <button type="button" data-action="export-release">Export release package</button>
        </section>
        <section id="publish" class="panel">
          <header>
            <h2>Publish</h2>
            <p>S3/R2 keys and GitHub tokens are requested only when publishing and never persisted.</p>
          </header>
          <form class="grid" onsubmit="return false">
            <label>
              S3/R2 access key
              <input id="s3-access-key" name="s3-access-key" autocomplete="off" data-secret="s3-access-key" />
            </label>
            <label>
              GitHub token
              <input id="github-token" name="github-token" autocomplete="off" data-secret="github-token" type="password" />
            </label>
          </form>
          <div class="actions">
            <button type="button" data-action="publish-s3">Publish S3/R2</button>
            <button type="button" data-action="publish-github">Publish GitHub Release</button>
          </div>
        </section>
      </main>
    </section>
  `;
}
