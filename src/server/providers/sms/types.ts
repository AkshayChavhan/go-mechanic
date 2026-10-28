// What every SMS provider does. The login code (src/server/auth/) only knows
// this shape, so swapping the fake for a real provider (task 44: MSG91)
// changes no login code.

import "server-only";

export type SmsMessage = {
  /** E.164: "+919876543210". */
  to: string;
  text: string;
};

export type SmsProvider = {
  /** Sends one SMS. Rejects when it couldn't be sent. */
  send(message: SmsMessage): Promise<void>;
};
