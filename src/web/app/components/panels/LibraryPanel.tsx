import type { WebProfilesWorkspace } from "../../../workspace";
import { EntryTable } from "../EntryTable";

export interface LibraryPanelProps {
  workspace: WebProfilesWorkspace;
  onLoadBaseline: () => void;
  onUploadLuts: () => void;
}

const actionButton =
  "rounded border border-line bg-surface px-3 py-1.5 text-sm text-ink hover:border-accent hover:text-accent";

export function LibraryPanel({
  workspace,
  onLoadBaseline,
  onUploadLuts,
}: LibraryPanelProps) {
  return (
    <section id="library" className="rounded-lg border border-line bg-surface p-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-ink">Library</h2>
        <p className="text-sm text-ink-soft">
          {workspace.entries.length} LUT entries across baseline and uploaded
          batches.
        </p>
      </header>
      <div className="mb-4 flex gap-2">
        <button type="button" className={actionButton} onClick={onLoadBaseline}>
          Load baseline
        </button>
        <button type="button" className={actionButton} onClick={onUploadLuts}>
          Upload LUTs
        </button>
      </div>
      <h3 className="mb-2 text-sm font-medium text-ink">Upload batches</h3>
      <ul aria-label="Upload batches" className="mb-4 space-y-1 text-sm text-ink-soft">
        {workspace.batches.length === 0 ? (
          <li>No upload batches yet</li>
        ) : (
          workspace.batches.map((batch) => (
            <li key={batch.id}>
              {batch.name} <span className="text-ink-soft">{batch.entryIds.length} LUTs</span>
            </li>
          ))
        )}
      </ul>
      <EntryTable entries={workspace.entries} />
    </section>
  );
}
