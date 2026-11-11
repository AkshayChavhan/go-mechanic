// npm run staging:seed: Adds the seed rows the staging database is missing.
// Task 20; document/operations/staging.md.

import { runScript } from "./run";
import { seedStaging } from "./tasks";

void runScript("staging:seed", () => seedStaging());
