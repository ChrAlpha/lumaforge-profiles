import {
  createWebProfilesWorkspace,
  restorePersistedWorkspace,
  type PersistedWebWorkspace,
  type WebProfilesWorkspace,
  type WebWorkspaceEntry,
} from "../workspace";

/**
 * Pure, synchronous, framework-agnostic reducer for the studio workspace.
 *
 * The reducer state is the {@link WebProfilesWorkspace} only. All async work
 * (fetching baseline catalogs, hashing uploaded LUTs via `addLutUploadBatch`)
 * happens in callers; the resulting workspace value is dispatched back in.
 * Credentials/secrets are intentionally NOT modeled here.
 */
export type WorkspaceAction =
  | { type: "restore"; persisted: PersistedWebWorkspace }
  | { type: "load-baseline"; baselineEntries: WebWorkspaceEntry[]; now: string }
  | { type: "set-workspace"; workspace: WebProfilesWorkspace };

export function initialWorkspaceState(now: string): WebProfilesWorkspace {
  return createWebProfilesWorkspace({ now });
}

export function workspaceReducer(
  state: WebProfilesWorkspace,
  action: WorkspaceAction,
): WebProfilesWorkspace {
  switch (action.type) {
    case "restore":
      return restorePersistedWorkspace(action.persisted);
    case "load-baseline":
      return createWebProfilesWorkspace({
        baselineEntries: action.baselineEntries,
        now: action.now,
      });
    case "set-workspace":
      return action.workspace;
    default: {
      const exhaustiveCheck: never = action;
      void exhaustiveCheck;
      return state;
    }
  }
}
