import { describe, expect, test } from "vitest";

import { type GitRunner, originMainProblems } from "./guards";

/** A fake git: `answers` maps the git subcommand to what it prints and returns. */
function fakeGit(answers: Partial<Record<string, { status?: number; stdout?: string }>>): GitRunner & { calls: string[][] } {
  const calls: string[][] = [];
  const git = ((args: string[]) => {
    calls.push(args);
    const answer = answers[args[0]!] ?? {};
    return { status: answer.status ?? 0, stdout: answer.stdout ?? "" };
  }) as GitRunner & { calls: string[][] };
  git.calls = calls;
  return git;
}

describe("originMainProblems", () => {
  test("a checkout whose migrations and seed data match origin/main may write to staging", () => {
    const git = fakeGit({});
    expect(originMainProblems(git)).toEqual([]);
    expect(git.calls[0]).toEqual(["fetch", "--quiet", "origin", "main"]);
  });

  test("a changed or new migration is refused, and the files are named", () => {
    const problems = originMainProblems(
      fakeGit({
        diff: { stdout: "src/server/db/migrations/meta/_journal.json\n" },
        "ls-files": { stdout: "src/server/db/migrations/0009_mine.sql\n" },
      }),
    );
    expect(problems.join(" ")).toContain("src/server/db/migrations/meta/_journal.json");
    expect(problems.join(" ")).toContain("0009_mine.sql");
    expect(problems.at(-1)).toContain("up-to-date main");
  });

  test("a failed fetch is refused before anything is compared", () => {
    const git = fakeGit({ fetch: { status: 128 } });
    expect(originMainProblems(git)).toHaveLength(1);
    expect(git.calls).toHaveLength(1);
  });
});
