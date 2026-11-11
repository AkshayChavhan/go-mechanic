// npm run staging:check: Checks the staging database before a staging build (vercel.json).
// Task 20; document/operations/staging.md.

import { runScript } from "./run";
import { checkStaging } from "./tasks";

void runScript("staging:check", () => checkStaging());
