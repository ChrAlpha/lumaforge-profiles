import { useState } from "react";

export interface SecretFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}

const inputClass =
  "mt-1 w-full rounded border border-line bg-paper px-3 py-1.5 pr-16 text-sm text-ink outline-none focus:border-accent";
const toggleClass =
  "absolute bottom-1 right-1 rounded border border-line bg-surface px-2 py-1 text-xs text-ink-soft outline-none hover:border-accent hover:text-accent focus:border-accent";

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
      <label htmlFor={id} className="block text-sm text-ink-soft">
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
          aria-label={revealed ? "Hide" : "Show"}
          className={toggleClass}
          onClick={() => setRevealed((prev) => !prev)}
        >
          {revealed ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
