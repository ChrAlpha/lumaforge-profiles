import { useState } from "react";

export interface SecretFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}

const inputClass =
  "mt-1.5 w-full rounded-md border border-line bg-paper px-3 py-2 pr-16 text-sm text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent";
const toggleClass =
  "absolute bottom-1 right-1 rounded border border-line bg-surface px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/**
 * Controlled masked credential input with a local-only show/hide toggle.
 *
 * The secret value is owned entirely by the caller (App.tsx in-memory state,
 * never persisted). This component holds nothing but the boolean reveal flag
 * and must never persist, cache, or otherwise expose the value.
 */
export function SecretField({
  id,
  label,
  value,
  onChange,
  autoComplete = "off",
}: SecretFieldProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink-soft">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={revealed ? "text" : "password"}
          autoComplete={autoComplete}
          className={inputClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          aria-pressed={revealed}
          aria-label={`${revealed ? "Hide" : "Show"} ${label}`}
          className={toggleClass}
          onClick={() => setRevealed((prev) => !prev)}
        >
          {revealed ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
