// The SMS provider this deployment uses, picked by SMS_PROVIDER
// (serverEnv().smsProvider). Only the fake exists until task 44.

import "server-only";

import { saveDevMessage } from "@/server/dal/dev-messages";
import { serverEnv } from "@/server/env";

import { createFakeSmsProvider } from "./fake";
import type { SmsProvider } from "./types";

export type { SmsMessage, SmsProvider } from "./types";

export function smsProvider(): SmsProvider {
  const env = serverEnv();
  switch (env.smsProvider) {
    case "fake":
      return createFakeSmsProvider({ save: saveDevMessage, outboxFile: env.e2eOutboxFile });
  }
}
