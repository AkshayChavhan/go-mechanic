// Which messages the browser gets.
//
// Server components read their text on the server; only client components
// ("use client") need messages in the browser. Without a `messages` prop,
// NextIntlClientProvider sends the whole of messages/en.json with every page,
// so the layouts pass pickClientMessages(...) instead.
//
// Client components get most of their labels as props from the server (see
// MobileMenu), so this list stays short. client-messages.test.ts reads every
// client file and fails if one asks for a namespace that isn't listed here.

import type { Messages } from "next-intl";

/** The message namespaces client components use. */
export const clientNamespaces = ["OpenStatus"] as const satisfies readonly (keyof Messages)[];

type ClientNamespace = (typeof clientNamespaces)[number];

/** Just the client namespaces, for <NextIntlClientProvider messages={...}>. */
export function pickClientMessages(messages: Messages): Pick<Messages, ClientNamespace> {
  return Object.fromEntries(clientNamespaces.map((namespace) => [namespace, messages[namespace]])) as Pick<
    Messages,
    ClientNamespace
  >;
}
