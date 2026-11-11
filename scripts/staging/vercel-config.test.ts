import fs from "node:fs";
import path from "node:path";

import { expect, test } from "vitest";

// vercel.json is staging's whole build setup in the repo (task 20, KTD8 and
// KTD9): the dashboard sets no region and no build command.
const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
  buildCommand?: string;
  regions?: string[];
};

test("the Vercel build checks the staging database before building pages", () => {
  expect(config.buildCommand).toBe("npm run staging:check && npm run build");
});

test("functions run in Mumbai (bom1), the one region Hobby allows", () => {
  expect(config.regions).toEqual(["bom1"]);
});
