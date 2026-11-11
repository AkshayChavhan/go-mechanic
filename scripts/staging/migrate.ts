// npm run staging:migrate: Applies main's migrations to the staging database.
// Task 20; document/operations/staging.md.

import { runScript } from "./run";
import { migrateStaging } from "./tasks";

void runScript("staging:migrate", () => migrateStaging());
