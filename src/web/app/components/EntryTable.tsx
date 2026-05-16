import type { WebWorkspaceEntry } from "../../workspace";

function entryWarnings(entry: WebWorkspaceEntry): string {
  if (entry.review.warnings.length === 0) {
    return "Ready";
  }
  return entry.review.warnings.join(" ");
}

export interface EntryTableProps {
  entries: WebWorkspaceEntry[];
}

export function EntryTable({ entries }: EntryTableProps) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-line text-left text-ink-soft">
          <th className="py-2 pr-4 font-medium">Title</th>
          <th className="py-2 pr-4 font-medium">Status</th>
          <th className="py-2 pr-4 font-medium">Batch</th>
          <th className="py-2 pr-4 font-medium">SHA-256</th>
          <th className="py-2 font-medium">Review</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const asset = entry.manifest.assets[0];
          return (
            <tr key={entry.id} className="border-b border-line/60 align-top">
              <td className="py-2 pr-4 text-ink">{entry.manifest.title}</td>
              <td className="py-2 pr-4 text-ink-soft">{entry.status}</td>
              <td className="py-2 pr-4 text-ink-soft">
                {entry.batchId ?? "baseline"}
              </td>
              <td className="py-2 pr-4 font-mono text-xs text-ink-soft">
                {asset?.sha256.slice(0, 12) ?? ""}
              </td>
              <td className="py-2 text-ink-soft">{entryWarnings(entry)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
