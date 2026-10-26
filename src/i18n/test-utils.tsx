import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import messages from "../../messages/en.json";
import { defaultLocale, GARAGE_TIME_ZONE } from "./config";

/**
 * Renders a component the way the app does: inside next-intl's provider with
 * the real English messages, so tests use the same text visitors see.
 */
export function renderWithIntl(ui: ReactElement, options?: RenderOptions) {
  return render(
    <NextIntlClientProvider locale={defaultLocale} messages={messages} timeZone={GARAGE_TIME_ZONE}>
      {ui}
    </NextIntlClientProvider>,
    options,
  );
}
