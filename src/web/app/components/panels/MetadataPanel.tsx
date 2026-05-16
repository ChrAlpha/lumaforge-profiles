import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";

import type { WebProfilesWorkspace } from "../../../workspace";

export interface MetadataPanelProps {
  workspace: WebProfilesWorkspace;
}

const tabTrigger =
  "shrink-0 rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent data-[state=active]:border-accent data-[state=active]:text-accent";

export function MetadataPanel({ workspace }: MetadataPanelProps) {
  const { entries } = workspace;
  // View-only state: which entry's manifest is previewed. Defaults to the
  // first entry so the initial render matches the legacy hard-wired view.
  const [selectedId, setSelectedId] = useState<string | undefined>(
    entries[0]?.id,
  );

  const selected =
    entries.find((entry) => entry.id === selectedId) ?? entries[0];
  const manifestPreview = selected
    ? JSON.stringify(selected.manifest, null, 2)
    : "{}";

  return (
    <section id="metadata" className="rounded-lg border border-line bg-surface p-6">
      <header className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Metadata</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Review generated fields before publishing.
        </p>
      </header>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Manifest preview
      </h3>
      {entries.length > 0 ? (
        <Tabs.Root
          value={selected?.id}
          onValueChange={setSelectedId}
          orientation="horizontal"
        >
          <Tabs.List
            aria-label="Manifest entry"
            className="mb-3 flex gap-2 overflow-x-auto pb-1"
          >
            {entries.map((entry) => (
              <Tabs.Trigger
                key={entry.id}
                value={entry.id}
                className={tabTrigger}
              >
                {entry.manifest.title || entry.id}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          {selected ? (
            <Tabs.Content value={selected.id} forceMount>
              <pre className="max-h-80 overflow-auto rounded-md border border-line bg-paper p-4 font-mono text-xs leading-relaxed text-ink">
                {manifestPreview}
              </pre>
            </Tabs.Content>
          ) : null}
        </Tabs.Root>
      ) : (
        <pre className="max-h-80 overflow-auto rounded-md border border-line bg-paper p-4 font-mono text-xs leading-relaxed text-ink">
          {manifestPreview}
        </pre>
      )}
    </section>
  );
}
