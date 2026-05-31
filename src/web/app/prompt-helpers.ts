import type { PromptRequest } from "./components/usePromptDialog";

export type Prompt = (
  request: PromptRequest,
) => Promise<Record<string, string> | null>;

export function messageFromError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "Unknown error.";
}

function releaseDefaults(): { tag: string; publicBaseUrl: string } {
  return {
    tag: `v${new Date().toISOString().slice(0, 10).replaceAll("-", ".")}`,
    publicBaseUrl: "https://profiles.example.com",
  };
}

export async function promptReleaseOptions(prompt: Prompt, title: string) {
  const defaults = releaseDefaults();
  const values = await prompt({
    title,
    fields: [
      { name: "tag", label: "Release tag", defaultValue: defaults.tag },
      {
        name: "publicBaseUrl",
        label: "Public base URL",
        defaultValue: defaults.publicBaseUrl,
      },
    ],
  });
  const tag = values?.tag ?? "";
  const publicBaseUrl = values?.publicBaseUrl ?? "";
  return tag && publicBaseUrl ? { tag, publicBaseUrl } : null;
}
