// The server's settings, read from environment variables and checked in one
// place. Other server code calls serverEnv() instead of reading process.env.
//
//   APP_ENV       which deployment this is: "local" (the default), "staging"
//                 or "production". Task 20 sets it on Vercel.
//   DATABASE_URL  a Postgres URL (postgres:// or postgresql://). Required in
//                 staging and production. Locally it's optional: without it
//                 the app uses PGlite (src/server/db/index.ts).
//
// DATABASE_URL holds a password, so error messages name a variable but never
// print its value: errors end up in logs that more people can read.
//
// `import "server-only"` makes the build fail if a browser component ever
// imports this file, so the URL can't end up in the JavaScript visitors download.

import "server-only";

export const APP_ENVS = ["local", "staging", "production"] as const;

export type AppEnv = (typeof APP_ENVS)[number];

export type ServerEnv = {
  appEnv: AppEnv;
  /** The Postgres URL, or undefined to use PGlite (only allowed locally). */
  databaseUrl: string | undefined;
};

/** What's wrong with one variable. Codes, not sentences, like HoursProblem. */
export type ServerEnvProblem =
  | { variable: "APP_ENV"; problem: "unknown" | "local-on-vercel" }
  | { variable: "DATABASE_URL"; problem: "missing" | "not-postgres" };

// One readable line per problem. None of them includes a value.
const explanations: Record<ServerEnvProblem["problem"], string> = {
  unknown: `must be one of ${APP_ENVS[0]}, ${APP_ENVS[1]} or ${APP_ENVS[2]}`,
  "local-on-vercel": "must be staging or production on Vercel (it is unset or local)",
  missing: "is required when APP_ENV is staging or production",
  "not-postgres": "must start with postgres:// or postgresql://",
};

/** Thrown by parseServerEnv, with every problem it found. */
export class ServerEnvError extends Error {
  readonly problems: ServerEnvProblem[];

  constructor(problems: ServerEnvProblem[]) {
    const lines = problems.map(({ variable, problem }) => `- ${variable} ${explanations[problem]}`);
    super(`The server's environment variables are wrong:\n${lines.join("\n")}`);
    this.name = "ServerEnvError";
    this.problems = problems;
  }
}

/** A variable's value, or undefined when it's missing or only spaces. */
function valueOf(vars: Record<string, string | undefined>, name: string): string | undefined {
  const value = vars[name]?.trim();
  return value ? value : undefined;
}

function isAppEnv(value: string): value is AppEnv {
  return (APP_ENVS as readonly string[]).includes(value);
}

/**
 * Checks the variables and returns the settings, or throws one
 * ServerEnvError that lists every problem. Pure: tests pass a plain object.
 */
export function parseServerEnv(vars: Record<string, string | undefined>): ServerEnv {
  const problems: ServerEnvProblem[] = [];

  const rawAppEnv = valueOf(vars, "APP_ENV") ?? "local";
  const appEnv = isAppEnv(rawAppEnv) ? rawAppEnv : undefined;
  if (!appEnv) {
    problems.push({ variable: "APP_ENV", problem: "unknown" });
  } else if (appEnv === "local" && valueOf(vars, "VERCEL")) {
    // Vercel sets VERCEL=1 on every deployment. A deployment that forgot
    // APP_ENV would otherwise run as "local", with an empty in-memory database.
    problems.push({ variable: "APP_ENV", problem: "local-on-vercel" });
  }

  const databaseUrl = valueOf(vars, "DATABASE_URL");
  if (databaseUrl === undefined) {
    if (appEnv === "staging" || appEnv === "production") {
      problems.push({ variable: "DATABASE_URL", problem: "missing" });
    }
  } else if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    problems.push({ variable: "DATABASE_URL", problem: "not-postgres" });
  }

  // A missing appEnv always comes with a problem; checking it too tells
  // TypeScript that appEnv is set below.
  if (problems.length > 0 || !appEnv) throw new ServerEnvError(problems);
  return { appEnv, databaseUrl };
}

let remembered: ServerEnv | undefined;

/**
 * The server's settings from process.env, checked on the first call and
 * remembered after that. Throws ServerEnvError while they're wrong (nothing
 * is remembered then, so every call throws).
 */
export function serverEnv(): ServerEnv {
  remembered ??= parseServerEnv(process.env);
  return remembered;
}
