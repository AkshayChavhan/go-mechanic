// The fake SMS provider: it sends nothing. It stores each message in the
// dev_messages table, which /dev/outbox shows under `npm run dev`. When the
// browser tests set E2E_OUTBOX_FILE, it also adds the message to that file
// as one JSON line, so a test can read its code (the production build the
// tests run has no /dev/outbox).
//
// Production refuses to start with this provider (src/server/env.ts).

import "server-only";

import { appendFile } from "node:fs/promises";

import { type Clock, systemClock } from "@/lib/clock";
import type { DevMessageInput } from "@/server/dal/dev-messages";

import type { SmsProvider } from "./types";

export type FakeSmsDependencies = {
  /** Stores the message (saveDevMessage). */
  save: (message: DevMessageInput) => Promise<void>;
  /** The browser tests' file, or undefined. */
  outboxFile: string | undefined;
  /** Where "now" comes from, for the file's sentAt (tests pass fixedClock). */
  clock?: Clock;
};

export function createFakeSmsProvider({ save, outboxFile, clock = systemClock }: FakeSmsDependencies): SmsProvider {
  return {
    async send({ to, text }) {
      // Never logged: the text holds a login code.
      await save({ channel: "sms", recipient: to, body: text });
      if (outboxFile) {
        await appendFile(outboxFile, `${JSON.stringify({ to, text, sentAt: clock.now().toISOString() })}\n`);
      }
    },
  };
}
