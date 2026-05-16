import type { WebProfilesWorkspace } from "../../workspace";
import { BuildPanel } from "./panels/BuildPanel";
import { LibraryPanel } from "./panels/LibraryPanel";
import { MetadataPanel } from "./panels/MetadataPanel";
import { PublishPanel } from "./panels/PublishPanel";

export interface ShellProps {
  workspace: WebProfilesWorkspace;
  status: string;
  s3AccessKeyId: string;
  githubToken: string;
  onS3AccessKeyIdChange: (value: string) => void;
  onGithubTokenChange: (value: string) => void;
  onLoadBaseline: () => void;
  onUploadLuts: () => void;
  onBuildS3Plan: () => void;
  onExportRelease: () => void;
  onPublishS3: () => void;
  onPublishGithub: () => void;
}

const navLink = "block py-1 text-sm text-ink-soft hover:text-accent";

export function Shell(props: ShellProps) {
  const { workspace, status } = props;

  return (
    <div
      data-app-root
      className="grid min-h-screen grid-cols-1 bg-paper text-ink lg:grid-cols-[16rem_1fr]"
    >
      <aside className="border-b border-line bg-surface p-6 lg:border-b-0 lg:border-r">
        <h1 className="text-xl font-semibold text-ink">
          LumaForge Profiles Studio
        </h1>
        <nav className="mt-4">
          <a href="#library" className={navLink}>
            Library
          </a>
          <a href="#metadata" className={navLink}>
            Metadata
          </a>
          <a href="#build" className={navLink}>
            Build
          </a>
          <a href="#publish" className={navLink}>
            Publish
          </a>
        </nav>
        <p className="mt-6 text-xs text-ink-soft">
          Credentials stay in memory only.
        </p>
      </aside>
      <main className="space-y-6 p-6">
        <LibraryPanel
          workspace={workspace}
          onLoadBaseline={props.onLoadBaseline}
          onUploadLuts={props.onUploadLuts}
        />
        <MetadataPanel workspace={workspace} />
        <BuildPanel
          onBuildS3Plan={props.onBuildS3Plan}
          onExportRelease={props.onExportRelease}
        />
        <PublishPanel
          s3AccessKeyId={props.s3AccessKeyId}
          githubToken={props.githubToken}
          onS3AccessKeyIdChange={props.onS3AccessKeyIdChange}
          onGithubTokenChange={props.onGithubTokenChange}
          onPublishS3={props.onPublishS3}
          onPublishGithub={props.onPublishGithub}
        />
        <div
          data-status
          role="status"
          aria-live="polite"
          className="text-sm text-ink-soft"
        >
          {status}
        </div>
      </main>
    </div>
  );
}
