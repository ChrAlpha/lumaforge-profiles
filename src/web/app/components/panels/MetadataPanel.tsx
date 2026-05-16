import type { WebProfilesWorkspace } from "../../../workspace";

export interface MetadataPanelProps {
  workspace: WebProfilesWorkspace;
}

export function MetadataPanel({ workspace }: MetadataPanelProps) {
  const selected = workspace.entries[0];
  const manifestPreview = selected
    ? JSON.stringify(selected.manifest, null, 2)
    : "{}";

  return (
    <section id="metadata" className="rounded-lg border border-line bg-surface p-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-ink">Metadata</h2>
        <p className="text-sm text-ink-soft">
          Review generated fields before publishing.
        </p>
      </header>
      <h3 className="mb-2 text-sm font-medium text-ink">Manifest preview</h3>
      <pre className="overflow-auto rounded border border-line bg-paper p-4 font-mono text-xs text-ink">
        {manifestPreview}
      </pre>
    </section>
  );
}
