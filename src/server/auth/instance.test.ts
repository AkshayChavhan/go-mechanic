import { afterEach, describe, expect, test, vi } from "vitest";

import { getDatabase } from "@/server/db";

import { createAuth } from "./auth";
import { getAuth } from "./instance";

vi.mock("@/server/db", () => ({ getDatabase: vi.fn() }));
vi.mock("./auth", () => ({ createAuth: vi.fn(() => ({ api: {} })) }));
vi.mock("@/server/env", () => ({
  serverEnv: () => ({
    appEnv: "staging",
    databaseUrl: "postgres://x",
    authSecret: "s".repeat(32),
    smsProvider: "fake",
    e2eOutboxFile: undefined,
  }),
}));

afterEach(() => {
  delete (globalThis as { appAuth?: unknown }).appAuth;
  vi.clearAllMocks();
});

describe("getAuth (one Better Auth per process)", () => {
  test("builds it once, from the settings, and returns the same one after that", async () => {
    vi.mocked(getDatabase).mockResolvedValue({} as never);
    const first = await getAuth();
    expect(await getAuth()).toBe(first);
    expect(createAuth).toHaveBeenCalledTimes(1);
    expect(createAuth).toHaveBeenCalledWith(
      expect.objectContaining({ secret: "s".repeat(32), secureCookies: true }),
    );
  });

  test("a failed build isn't remembered: the next call tries again", async () => {
    vi.mocked(getDatabase).mockRejectedValueOnce(new Error("database down")).mockResolvedValue({} as never);
    await expect(getAuth()).rejects.toThrow("database down");
    await expect(getAuth()).resolves.toBeDefined();
  });
});
