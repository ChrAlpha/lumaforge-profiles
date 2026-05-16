import { createContext, useCallback, useContext, useId, useState } from "react";
import * as Toast from "@radix-ui/react-toast";

export type StatusToastVariant = "success" | "error";

export interface StatusToastApi {
  notify: (message: string, variant?: StatusToastVariant) => void;
}

interface ActiveToast {
  id: string;
  message: string;
  variant: StatusToastVariant;
}

const StatusToastContext = createContext<StatusToastApi | null>(null);

/** Auto-dismiss window for a single toast. One sensible default (YAGNI). */
const TOAST_DURATION_MS = 5000;

const viewport =
  "fixed bottom-0 right-0 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 p-6 outline-none";
const toastBase =
  "rounded-lg border bg-surface px-4 py-3 text-sm shadow-xl data-[state=open]:animate-in";
const variantClass: Record<StatusToastVariant, string> = {
  success: "border-line text-positive",
  error: "border-accent text-accent",
};
const closeButton =
  "ml-3 rounded border border-line bg-surface px-2 py-0.5 text-xs text-ink-soft hover:border-accent hover:text-accent";

/**
 * Wraps the app in a Radix Toast region and exposes an imperative `notify`.
 * Radix Toast is itself an ARIA live region, so messages are announced without
 * any hand-rolled `role`/`aria-live`.
 */
export function StatusToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const baseId = useId();

  const notify = useCallback(
    (message: string, variant: StatusToastVariant = "success") => {
      setToasts((prev) => [
        ...prev,
        { id: `${baseId}-${prev.length}-${Date.now()}`, message, variant },
      ]);
    },
    [baseId],
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <StatusToastContext.Provider value={{ notify }}>
      <Toast.Provider duration={TOAST_DURATION_MS} swipeDirection="right">
        {children}
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            data-variant={toast.variant}
            className={`${toastBase} ${variantClass[toast.variant]}`}
            onOpenChange={(open) => {
              if (!open) {
                dismiss(toast.id);
              }
            }}
          >
            <div className="flex items-start justify-between">
              <Toast.Description>{toast.message}</Toast.Description>
              <Toast.Close className={closeButton} aria-label="Close">
                Close
              </Toast.Close>
            </div>
          </Toast.Root>
        ))}
        <Toast.Viewport className={viewport} />
      </Toast.Provider>
    </StatusToastContext.Provider>
  );
}

export function useStatusToast(): StatusToastApi {
  const api = useContext(StatusToastContext);
  if (api === null) {
    throw new Error("useStatusToast must be used within a StatusToastProvider");
  }
  return api;
}
