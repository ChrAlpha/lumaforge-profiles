import type { WebProfilesWorkspace } from "../../../workspace";
import { EntryTable } from "../EntryTable";

export interface LibraryPanelProps {
  workspace: WebProfilesWorkspace;
  onLoadBaseline: () => void;
  onUploadLuts: () => void;
}

const actionButton =
  "rounded-md border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

function lutCountLabel(count: number) {
  return `${count} ${count === 1 ? "LUT" : "LUTs"}`;
}

export function LibraryPanel({
  workspace,
  onLoadBaseline,
  onUploadLuts,
}: LibraryPanelProps) {
  return (
    <section id="library" className="rounded-lg border border-line bg-surface p-6">
      <header className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Library</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          {workspace.entries.length} LUT entries across baseline and uploaded
          batches.
        </p>
      </header>
      <div className="mb-6 flex flex-wrap gap-2">
        <button type="button" className={actionButton} onClick={onLoadBaseline}>
          Load baseline
        </button>
        <button type="button" className={actionButton} onClick={onUploadLuts}>
          Upload LUTs
        </button>
      </div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Upload batches
      </h3>
      <ul aria-label="Upload batches" className="mb-6 space-y-1 text-sm text-ink-soft">
        {workspace.batches.length === 0 ? (
          <li>No upload batches yet</li>
        ) : (
          workspace.batches.map((batch) => (
            <li
              key={batch.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1"
            >
              <span className="font-medium text-ink">{batch.name}</span>
              <span className="rounded border border-line px-2 py-0.5 text-xs">
                {lutCountLabel(batch.entryIds.length)}
              </span>
            </li>
          ))
        )}
      </ul>
      <EntryTable entries={workspace.entries} />
    </section>
  );
}
