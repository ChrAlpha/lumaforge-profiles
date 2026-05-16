import { SecretField } from "../SecretField";

export interface PublishPanelProps {
  s3AccessKeyId: string;
  githubToken: string;
  onS3AccessKeyIdChange: (value: string) => void;
  onGithubTokenChange: (value: string) => void;
  onPublishS3: () => void;
  onPublishGithub: () => void;
}

const actionButton =
  "rounded-md border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function PublishPanel({
  s3AccessKeyId,
  githubToken,
  onS3AccessKeyIdChange,
  onGithubTokenChange,
  onPublishS3,
  onPublishGithub,
}: PublishPanelProps) {
  return (
    <section id="publish" className="rounded-lg border border-line bg-surface p-6">
      <header className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Publish</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          S3/R2 keys and GitHub tokens are requested only when publishing and
          never persisted.
        </p>
      </header>
      <form
        className="mb-6 grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => event.preventDefault()}
      >
        <SecretField
          id="s3-access-key"
          label="S3/R2 access key"
          value={s3AccessKeyId}
          onChange={onS3AccessKeyIdChange}
        />
        <SecretField
          id="github-token"
          label="GitHub token"
          value={githubToken}
          onChange={onGithubTokenChange}
        />
      </form>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={actionButton} onClick={onPublishS3}>
          Publish S3/R2
        </button>
        <button type="button" className={actionButton} onClick={onPublishGithub}>
          Publish GitHub Release
        </button>
      </div>
    </section>
  );
}
