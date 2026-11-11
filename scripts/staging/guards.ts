// The staging database is shared, and drizzle's migrator skips, without an
// error, a migration older than the newest one it has applied. So staging is
// migrated and seeded only from a checkout whose migrations and seed data are
// exactly origin/main's (task 20, KTD6): never from an unmerged branch with a
// migration of its own.

import { execFileSync } from "node:child_process";

/** The paths that must match origin/main before anything writes to staging. */
export const GUARDED_PATHS = [
  "src/server/db/migrations",
  "src/server/db/seed-data.ts",
  "src/server/db/vehicle-seed-data.ts",
] as const;

/** Runs git with `args` and returns its exit status and output (injected in tests). */
export type GitRunner = (args: string[]) => { status: number; stdout: string };

export const runGit: GitRunner = (args) => {
  try {
    return { status: 0, stdout: execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }) };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string };
    return { status: failure.status ?? 1, stdout: failure.stdout ?? "" };
  }
};

/**
 * Why this checkout may not write to staging, or [] when it may: after a fresh
 * fetch, the guarded paths must equal origin/main's, with no edits and no new
 * files in them.
 */
export function originMainProblems(git: GitRunner = runGit): string[] {
  if (git(["fetch", "--quiet", "origin", "main"]).status !== 0) {
    return ["Couldn't fetch origin/main, so this checkout can't be compared with it. Check the network and try again."];
  }
  const problems: string[] = [];
  const changed = git(["diff", "--name-only", "origin/main", "--", ...GUARDED_PATHS]).stdout.trim();
  if (changed !== "") {
    problems.push(`These differ from origin/main: ${changed.split("\n").join(", ")}.`);
  }
  const untracked = git(["ls-files", "--others", "--exclude-standard", "--", ...GUARDED_PATHS]).stdout.trim();
  if (untracked !== "") {
    problems.push(`These new files aren't on origin/main: ${untracked.split("\n").join(", ")}.`);
  }
  if (problems.length > 0) {
    problems.push("Staging is migrated and seeded only from code that matches main: switch to an up-to-date main and run again.");
  }
  return problems;
}
