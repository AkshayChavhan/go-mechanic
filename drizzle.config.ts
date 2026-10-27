// Settings for drizzle-kit, the command-line tool that turns the schema
// (src/server/db/schema.ts) into SQL migration files.
//
//   npm run db:generate   compares schema.ts with the last migration and
//                         writes a new .sql file to src/server/db/migrations/
//
// Commit the new .sql file and the meta/ folder with the schema change, and
// never edit a migration that is already merged: write a new one instead.
//
// No database credentials here: `generate` only reads files. The app applies
// the migrations to the local database itself (src/server/db/index.ts).

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
});
