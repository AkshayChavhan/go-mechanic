import { screen } from "@testing-library/react";
import { use } from "react";
import { describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import messages from "../../../../messages/en.json";

import AdminPage from "./page";

// AdminOverview (the gate: it reads the session) is a stand-in. `suspend`
// makes it wait forever, as the real one waits for the request while the
// page is built ahead of time.
const overview = vi.hoisted(() => ({ suspend: false }));
vi.mock("@/components/admin/admin-overview", () => ({
  AdminOverview: ({ locale }: { locale: string }) => {
    if (overview.suspend) use(new Promise(() => {}));
    return <p data-testid="admin-overview">{`overview in ${locale}`}</p>;
  },
}));

const staffWords = [...Object.values(messages.Admin.nav), ...Object.values(messages.Admin.overview)];

describe("/admin", () => {
  test("the gate gets the locale", () => {
    overview.suspend = false;
    renderWithIntl(<AdminPage />);
    expect(screen.getByTestId("admin-overview").textContent).toBe("overview in en");
  });

  test("built ahead of time: only the neutral loading line, no heading and no staff word", () => {
    overview.suspend = true;
    const { container } = renderWithIntl(<AdminPage />);
    expect(screen.getByText(messages.Admin.loading)).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
    for (const word of staffWords) expect(container.textContent).not.toContain(word);
  });
});
