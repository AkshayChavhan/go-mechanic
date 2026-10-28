import { describe, expect, test, vi } from "vitest";

import { saveDevMessage } from "@/server/dal/dev-messages";
import { serverEnv } from "@/server/env";

import { smsProvider } from "./index";

vi.mock("@/server/env", () => ({ serverEnv: vi.fn() }));
vi.mock("@/server/dal/dev-messages", () => ({ saveDevMessage: vi.fn() }));

describe("smsProvider (picks the provider from SMS_PROVIDER)", () => {
  test("fake: stores messages through saveDevMessage", async () => {
    vi.mocked(serverEnv).mockReturnValue({
      appEnv: "local",
      databaseUrl: undefined,
      authSecret: "x".repeat(32),
      smsProvider: "fake",
      e2eOutboxFile: undefined,
      ownerPhoneNumber: "+919764750567",
    });
    vi.mocked(saveDevMessage).mockResolvedValue(undefined);

    await smsProvider().send({ to: "+919876543210", text: "hello" });
    expect(saveDevMessage).toHaveBeenCalledWith({ channel: "sms", recipient: "+919876543210", body: "hello" });
  });
});
