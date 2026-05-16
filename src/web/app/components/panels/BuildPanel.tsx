export interface BuildPanelProps {
  onBuildS3Plan: () => void;
  onExportRelease: () => void;
}

const actionButton =
  "rounded-md border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function BuildPanel({ onBuildS3Plan, onExportRelease }: BuildPanelProps) {
  return (
    <section id="build" className="rounded-lg border border-line bg-surface p-6">
      <header className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Build</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Build from carried baseline entries plus reviewed new entries.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={actionButton} onClick={onBuildS3Plan}>
          Build S3/R2 plan
        </button>
        <button type="button" className={actionButton} onClick={onExportRelease}>
          Export release package
        </button>
      </div>
    </section>
  );
}
