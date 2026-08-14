/** Wire types for the git-manager Remote. */

/** Point-in-time repository status. */
export interface GitStatus {
  /** Current branch name (empty when in detached HEAD). */
  branch: string
  /** True when the working tree has no uncommitted changes. */
  clean: boolean
  /** Commits ahead of the upstream tracking branch (0 when none configured). */
  ahead: number
  /** Commits behind the upstream tracking branch (0 when none configured). */
  behind: number
  /** `git status --short` lines, trimmed. */
  changes: string[]
}

/** One branch entry, local or remote. */
export interface GitBranch {
  /** Branch ref name (local: `BETA1`; remote: `origin/BETA1`). */
  name: string
  /** True when this is the currently checked-out branch. */
  current: boolean
  /** True when this is a remote-tracking branch. */
  remote: boolean
}

/** The branch list plus the current branch name. */
export interface GitBranches {
  current: string
  branches: GitBranch[]
}

/** Outcome of a mutating git operation. */
export interface GitOpResult {
  ok: boolean
  /** Human-readable message, suitable for UI display. */
  message: string
}
