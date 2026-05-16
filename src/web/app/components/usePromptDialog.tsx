import { useCallback, useRef, useState } from "react";

import { PromptDialog, type PromptField } from "./PromptDialog";

interface PendingPrompt {
  title: string;
  fields: PromptField[];
  submitLabel?: string;
  resolve: (values: Record<string, string> | null) => void;
}

export interface PromptRequest {
  title: string;
  fields: PromptField[];
  submitLabel?: string;
}

/**
 * Bridges the legacy straight-line `const x = await prompt(...)` flow onto an
 * accessible Radix dialog. `prompt` resolves with trimmed values on submit, or
 * `null` when the user cancels (mirroring the old empty/abort semantics).
 */
export function usePromptDialog(): {
  prompt: (request: PromptRequest) => Promise<Record<string, string> | null>;
  dialog: React.ReactNode;
} {
  const [pending, setPending] = useState<PendingPrompt | null>(null);
  const pendingRef = useRef<PendingPrompt | null>(null);
  pendingRef.current = pending;

  const prompt = useCallback(
    (request: PromptRequest) =>
      new Promise<Record<string, string> | null>((resolve) => {
        setPending({ ...request, resolve });
      }),
    [],
  );

  const settle = useCallback(
    (values: Record<string, string> | null) => {
      const current = pendingRef.current;
      setPending(null);
      current?.resolve(values);
    },
    [],
  );

  const dialog = (
    <PromptDialog
      open={pending !== null}
      title={pending?.title ?? ""}
      fields={pending?.fields ?? []}
      submitLabel={pending?.submitLabel}
      onSubmit={(values) => settle(values)}
      onCancel={() => settle(null)}
    />
  );

  return { prompt, dialog };
}
