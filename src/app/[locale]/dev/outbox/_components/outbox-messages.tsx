import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import { formatDate, formatTime } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import { formatPhoneNumber } from "@/lib/contact-links";
import { listDevMessages, type DevMessage } from "@/server/dal/dev-messages";

// The list on /dev/outbox. Kept out of page.tsx because a page file may only
// export what Next.js expects (the page, generateMetadata...), and the tests
// need to render this part on its own. A development-only page's component:
// demo text is typed here on purpose.

/**
 * The messages, newest first. It waits for a real request (connection()), so
 * every load reads the database again instead of showing a list saved when
 * the page was first built: a new code appears on Refresh. The page puts it
 * inside <Suspense> for that reason.
 */
export async function OutboxMessages({ locale }: { locale: Locale }) {
  await connection();
  const messages = await listDevMessages();

  if (messages.length === 0) {
    return (
      <p className="type-body">
        No messages yet. Ask for a code on the{" "}
        <Link href="/login" className="text-link underline underline-offset-4">
          login page
        </Link>
        , then come back and press Refresh.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      {messages.map((message) => (
        <li key={message.id}>
          <MessageCard message={message} locale={locale} />
        </li>
      ))}
    </ol>
  );
}

const channelNames: Record<DevMessage["channel"], string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
};

/**
 * One message. A 6-digit code is pulled out and shown big, in digits of
 * equal width, and one tap selects all of it (select-all), so it's easy to
 * read and copy on a phone. Who it went to, when (India time) and the full
 * text follow.
 */
export function MessageCard({ message, locale }: { message: DevMessage; locale: Locale }) {
  const code = /\b\d{6}\b/.exec(message.body)?.[0];
  const recipient = message.channel === "email" ? message.recipient : formatPhoneNumber(message.recipient);
  const sentAt = `${formatDate(message.createdAt, locale)} at ${formatTime(message.createdAt, locale)}`;

  return (
    <Card data-message={message.id}>
      <CardHeader>
        <CardTitle className="tabular-nums select-all">{code ?? recipient}</CardTitle>
        <CardDescription>
          To {recipient}, <time dateTime={message.createdAt.toISOString()}>{sentAt}</time>
        </CardDescription>
        <CardAction>
          <Badge variant="secondary">{channelNames[message.channel]}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="break-words">{message.body}</p>
      </CardContent>
    </Card>
  );
}
