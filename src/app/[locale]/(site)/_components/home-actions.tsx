import { PhoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { BookTarget } from "@/components/site/navigation";
import { WhatsAppLink } from "@/components/site/whatsapp-link";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatPhoneNumber, telHref } from "@/lib/contact-links";

type HomeActionsProps = {
  /** Where "Book a service" goes (bookTarget() in navigation.ts): WhatsApp until /book exists. */
  book: BookTarget;
  /** The garage's phone number, in E.164 form. */
  phone: string;
};

/**
 * The hero's and the final call to action's two buttons: one blue "Book a
 * service" and a grey Call. From 768px Call also shows the number, because a
 * tel: link does nothing on most computers.
 *
 * Never put these inside a ScrollScene reveal target: a hidden link could
 * take keyboard focus while invisible (plan KTD5).
 */
export function HomeActions({ book, phone }: HomeActionsProps) {
  const tHeader = useTranslations("Header");
  const tContact = useTranslations("Contact");

  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild size="lg">
        {book.kind === "page" ? (
          <Link href={book.href}>{tHeader("book")}</Link>
        ) : (
          <WhatsAppLink href={book.href}>{tHeader("book")}</WhatsAppLink>
        )}
      </Button>
      <Button asChild size="lg" variant="secondary">
        <a href={telHref(phone)}>
          <PhoneIcon data-icon="inline-start" />
          {tContact("call")}
          {/* The space keeps "Call +91 ..." apart for screen readers and search
              engines. It doesn't show: the button lays its parts out with a gap. */}{" "}
          <span className="hidden md:inline">{formatPhoneNumber(phone)}</span>
        </a>
      </Button>
    </div>
  );
}
