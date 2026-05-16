import type { WebWorkspaceEntryStatus } from "../../workspace";

interface BadgeTreatment {
  /** Human-readable text; carries meaning without relying on color. */
  label: string;
  /** @theme-token utility classes only (no raw CSS). */
  className: string;
}

const calm =
  "border-line bg-paper text-ink-soft";
const positive =
  "border-positive/40 bg-paper text-positive";
const inProgress =
  "border-accent/40 bg-paper text-ink";
const problem =
  "border-accent bg-paper text-accent";

/**
 * Exhaustive status -> badge mapping. The `satisfies Record<...>` annotation
 * is the compile-time exhaustiveness guard: TypeScript fails to build if the
 * `WebWorkspaceEntryStatus` union grows without a matching treatment here, or
 * if a key is added that is not part of the union.
 */
const TREATMENTS = {
  ready: { label: "Ready", className: positive },
  carried: { label: "Carried", className: calm },
  "new-draft": { label: "New draft", className: inProgress },
  "metadata-changed": { label: "Metadata changed", className: inProgress },
  "duplicate-asset": { label: "Duplicate asset", className: problem },
  "validation-error": { label: "Validation error", className: problem },
} satisfies Record<WebWorkspaceEntryStatus, BadgeTreatment>;

export interface StatusBadgeProps {
  status: WebWorkspaceEntryStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = TREATMENTS[status];
  return (
    <span
      data-status={status}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
