import * as Tooltip from "@radix-ui/react-tooltip";

import type { WebWorkspaceEntry } from "../../workspace";
import { StatusBadge } from "./StatusBadge";

export interface EntryTableProps {
  entries: WebWorkspaceEntry[];
}

const tooltipContent =
  "max-w-xs rounded-md border border-line bg-surface px-3 py-2 text-xs leading-relaxed text-ink shadow-lg";
const warningTrigger =
  "rounded border border-accent px-2 py-0.5 text-xs font-medium text-accent transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

function WarningsCell({ entry }: { entry: WebWorkspaceEntry }) {
  const { warnings } = entry.review;
  if (warnings.length === 0) {
    return <span className="text-ink-soft">Ready</span>;
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className={warningTrigger}
          aria-label={`${warnings.length} warnings`}
        >
          {`⚠ ${warnings.length} warnings`}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className={tooltipContent} sideOffset={4}>
          <ul className="space-y-1">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <Tooltip.Arrow className="fill-line" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function EntryTable({ entries }: EntryTableProps) {
  return (
    <Tooltip.Provider delayDuration={0} disableHoverableContent>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
            <th className="py-2.5 pr-4 font-semibold">Title</th>
            <th className="py-2.5 pr-4 font-semibold">Status</th>
            <th className="py-2.5 pr-4 font-semibold">Batch</th>
            <th className="py-2.5 pr-4 font-semibold">SHA-256</th>
            <th className="py-2.5 font-semibold">Review</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const asset = entry.manifest.assets[0];
            return (
              <tr key={entry.id} className="border-b border-line/60 align-top">
                <td className="py-2.5 pr-4 font-medium text-ink">{entry.manifest.title}</td>
                <td className="py-2.5 pr-4">
                  <StatusBadge status={entry.status} />
                </td>
                <td className="py-2.5 pr-4 text-ink-soft">
                  {entry.batchId ?? "baseline"}
                </td>
                <td className="py-2.5 pr-4 font-mono text-xs text-ink-soft">
                  {asset?.sha256.slice(0, 12) ?? ""}
                </td>
                <td className="py-2.5 text-ink-soft">
                  <WarningsCell entry={entry} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Tooltip.Provider>
  );
}
