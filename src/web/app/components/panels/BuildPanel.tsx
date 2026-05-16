export interface BuildPanelProps {
  onBuildS3Plan: () => void;
  onExportRelease: () => void;
}

const actionButton =
  "rounded border border-line bg-surface px-3 py-1.5 text-sm text-ink hover:border-accent hover:text-accent";

export function BuildPanel({ onBuildS3Plan, onExportRelease }: BuildPanelProps) {
  return (
    <section id="build" className="rounded-lg border border-line bg-surface p-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-ink">Build</h2>
        <p className="text-sm text-ink-soft">
          Build from carried baseline entries plus reviewed new entries.
        </p>
      </header>
      <div className="flex gap-2">
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
