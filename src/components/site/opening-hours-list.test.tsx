import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { WeeklyHours } from "@/domain/opening-hours";
import { renderWithIntl } from "@/i18n/test-utils";
import messages from "../../../messages/en.json";

import { OpeningHoursList } from "./opening-hours-list";

const garageHours: WeeklyHours = {
  monday: "closed",
  tuesday: { opens: "10:00", closes: "19:00" },
  wednesday: { opens: "10:00", closes: "19:00" },
  thursday: { opens: "10:00", closes: "19:00" },
  friday: { opens: "10:00", closes: "19:00" },
  saturday: { opens: "10:00", closes: "19:00" },
  sunday: { opens: "10:00", closes: "19:00" },
};

/** Each row of the list as [days, hours]. */
function rows(container: HTMLElement) {
  return [...container.querySelectorAll("dt")].map((term) => [term.textContent, term.nextElementSibling?.textContent]);
}

describe("OpeningHoursList", () => {
  test("groups the garage's week: Monday closed, Tuesday to Sunday 10:00 am to 7:00 pm", () => {
    const { container } = renderWithIntl(<OpeningHoursList hours={garageHours} />);
    expect(rows(container)).toEqual([
      ["Monday", messages.Hours.closed],
      ["Tuesday to Sunday", "10:00 am to 7:00 pm"],
    ]);
  });

  test("says the times are India time, for visitors abroad", () => {
    renderWithIntl(<OpeningHoursList hours={garageHours} />);
    expect(screen.getByText(messages.Hours.indiaTime)).toBeTruthy();
  });

  test("lists days that differ on their own rows", () => {
    const { container } = renderWithIntl(
      <OpeningHoursList hours={{ ...garageHours, sunday: { opens: "10:00", closes: "14:00" } }} />,
    );
    expect(rows(container)).toEqual([
      ["Monday", messages.Hours.closed],
      ["Tuesday to Saturday", "10:00 am to 7:00 pm"],
      ["Sunday", "10:00 am to 2:00 pm"],
    ]);
  });
});
