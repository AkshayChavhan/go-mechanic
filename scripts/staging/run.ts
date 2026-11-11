// Runs one staging script and turns any failure into plain lines that carry
// no secret: never the error object, whose message, `input` or query values
// could hold the database password or someone's data.

import { postgresCode } from "@/server/db/migration-check";

import { StagingSettingsError } from "./settings";

/** What a script reports: lines to print, and whether it succeeded. */
export type ScriptResult = { ok: boolean; lines: string[] };

/** The lines to print for a thrown error: our own messages as they are, anything else by name and Postgres code only. */
export function describeFailure(error: unknown): string[] {
  if (error instanceof StagingSettingsError) return [error.message];
  const name = error instanceof Error ? error.name : typeof error;
  const code = postgresCode(error);
  return [
    `Failed with ${name}${code ? ` (Postgres code ${code})` : ""}.`,
    'See document/operations/staging.md, "When something goes wrong".',
  ];
}

/** Runs `script`, prints its lines, and sets the exit code. */
export async function runScript(label: string, script: () => Promise<ScriptResult>): Promise<void> {
  let result: ScriptResult;
  try {
    result = await script();
  } catch (error) {
    result = { ok: false, lines: describeFailure(error) };
  }
  for (const line of result.lines) console.log(`${label}: ${line}`);
  process.exitCode = result.ok ? 0 : 1;
}
