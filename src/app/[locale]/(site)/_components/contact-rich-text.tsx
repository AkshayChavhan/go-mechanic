import type { ReactNode } from "react";

import { WhatsAppLink } from "@/components/site/whatsapp-link";
import type { Garage } from "@/domain/garage";
import { formatPhoneNumber, telHref, whatsappHref } from "@/lib/contact-links";

/** How a link looks inside running text on the info pages. */
export const inlineLinkClass = "text-link underline underline-offset-4";

/**
 * What a message with the garage's contact links needs for t.rich:
 * "call us on <call>{phone}</call> or message us on <whatsapp>WhatsApp</whatsapp>".
 * `phone` is the number as people read it; `call` dials it; `whatsapp` opens
 * a chat with `whatsappMessage` typed in (in a new tab, without the chat icon,
 * which looks odd inside a sentence).
 */
export function contactRichText(garage: Pick<Garage, "phone" | "whatsapp">, whatsappMessage: string) {
  return {
    phone: formatPhoneNumber(garage.phone),
    call: (chunks: ReactNode) => (
      <a href={telHref(garage.phone)} className={`whitespace-nowrap ${inlineLinkClass}`}>
        {chunks}
      </a>
    ),
    whatsapp: (chunks: ReactNode) => (
      <WhatsAppLink href={whatsappHref(garage.whatsapp, whatsappMessage)} className={`${inlineLinkClass} [&_svg]:hidden`}>
        {chunks}
      </WhatsAppLink>
    ),
  };
}
