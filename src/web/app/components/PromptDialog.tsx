import { useEffect, useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

export interface PromptField {
  name: string;
  label: string;
  defaultValue?: string;
  /** Defaults to true; optional fields may be left blank (mirrors the legacy
   * prompts where some inputs aborted on empty and others did not). */
  required?: boolean;
}

export interface PromptDialogProps {
  open: boolean;
  title: string;
  fields: PromptField[];
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}

function initialValues(fields: PromptField[]): Record<string, string> {
  return Object.fromEntries(
    fields.map((field) => [field.name, field.defaultValue ?? ""]),
  );
}

const overlay =
  "fixed inset-0 bg-black/50 data-[state=open]:animate-in";
const panel =
  "fixed left-1/2 top-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-surface p-6 text-ink shadow-xl";
const inputClass =
  "mt-1 w-full rounded border border-line bg-paper px-3 py-1.5 text-sm text-ink outline-none focus:border-accent";
const ghostButton =
  "rounded border border-line bg-surface px-3 py-1.5 text-sm text-ink hover:border-accent hover:text-accent";
const primaryButton =
  "rounded border border-line bg-surface px-3 py-1.5 text-sm text-positive hover:border-accent disabled:cursor-not-allowed disabled:opacity-50";

export function PromptDialog({
  open,
  title,
  fields,
  submitLabel = "Submit",
  onSubmit,
  onCancel,
}: PromptDialogProps) {
  const baseId = useId();
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(fields),
  );

  // Reset to defaults each time the dialog (re)opens so a reused instance never
  // shows stale input from a previous prompt.
  useEffect(() => {
    if (open) {
      setValues(initialValues(fields));
    }
    // fields identity changes per open via the App-side prompt state object.
  }, [open, fields]);

  const allFilled = fields.every(
    (field) =>
      field.required === false ||
      (values[field.name] ?? "").trim().length > 0,
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allFilled) {
      return;
    }
    const trimmed: Record<string, string> = {};
    for (const field of fields) {
      trimmed[field.name] = (values[field.name] ?? "").trim();
    }
    onSubmit(trimmed);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onCancel();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={overlay} />
        <Dialog.Content className={panel} aria-describedby={undefined}>
          <Dialog.Title className="text-lg font-semibold text-ink">
            {title}
          </Dialog.Title>
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            {fields.map((field, index) => {
              const fieldId = `${baseId}-${field.name}`;
              return (
                <div key={field.name}>
                  <label
                    htmlFor={fieldId}
                    className="block text-sm text-ink-soft"
                  >
                    {field.label}
                  </label>
                  <input
                    id={fieldId}
                    name={field.name}
                    type="text"
                    autoFocus={index === 0}
                    className={inputClass}
                    value={values[field.name] ?? ""}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        [field.name]: event.target.value,
                      }))
                    }
                  />
                </div>
              );
            })}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={ghostButton}
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={primaryButton}
                disabled={!allFilled}
              >
                {submitLabel}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
