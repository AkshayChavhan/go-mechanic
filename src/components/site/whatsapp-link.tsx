import { MessageCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

/**
 * A link that opens a WhatsApp chat (a wa.me address from whatsappHref in
 * src/lib/contact-links.ts). It always:
 * - opens in a new tab, so the visitor keeps the site open;
 * - shows a chat icon (decorative: screen readers skip it);
 * - adds "(opens WhatsApp)" for screen readers, so nobody is surprised when
 *   another app or tab opens.
 *
 * To make it look like a button, wrap it: <Button asChild><WhatsAppLink .../></Button>.
 * Button passes its classes down, so the extra props go onto the <a>.
 */
export function WhatsAppLink({ href, children, ...props }: ComponentProps<"a"> & { href: string }) {
  const t = useTranslations("Contact");
  return (
    // Props first, so nothing passed in can undo the new tab or its safety settings.
    // noopener: the new tab can't control this page. noreferrer: WhatsApp isn't told which page sent the visitor.
    <a {...props} href={href} target="_blank" rel="noopener noreferrer">
      <MessageCircleIcon data-icon="inline-start" />
      {children} <span className="sr-only">{t("opensWhatsApp")}</span>
    </a>
  );
}
