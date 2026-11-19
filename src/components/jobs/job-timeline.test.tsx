import { screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import type { JobUpdateEntry } from "@/server/dal/jobs";
import messages from "../../../messages/en.json";

import { JobTimeline, jobSteps } from "./job-timeline";

// JobTimeline is an async Server Component: each test calls it and renders
// what it returns, with next-intl's own translator over the real messages
// standing in for getTranslations.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: allMessages } = await import("../../../messages/en.json");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "en"; namespace: "JobTimeline" }) =>
      createTranslator({ locale, messages: allMessages, namespace }),
  };
});

const t = messages.JobTimeline;

function update(changes: Partial<JobUpdateEntry> = {}): JobUpdateEntry {
  return {
    id: `u${Math.random()}`,
    // 19 Nov 2026, 10:30 in India.
    createdAt: new Date("2026-11-19T05:00:00Z"),
    movedTo: null,
    stepAfter: "inspection",
    note: null,
    hadPhotos: false,
    photos: [],
    ...changes,
  };
}

/** Each step's label and state, in order, as shown. */
function shownSteps() {
  const list = screen.getByRole("heading", { name: t.stepsHeading }).parentElement!.querySelector("ol")!;
  return within(list)
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

describe("jobSteps", () => {
  test("not started: Booked is current, the rest to come, no approval step", () => {
    expect(jobSteps(null, [])).toEqual([
      { step: "booked", state: "current" },
      { step: "vehicle-received", state: "upcoming" },
      { step: "inspection", state: "upcoming" },
      { step: "in-service", state: "upcoming" },
      { step: "ready", state: "upcoming" },
      { step: "completed", state: "upcoming" },
    ]);
  });

  test("in service without an estimate: earlier steps done, no approval step", () => {
    const steps = jobSteps("in-service", [update({ movedTo: "inspection" })]);
    expect(steps.map((s) => s.step)).not.toContain("awaiting-approval");
    expect(steps.filter((s) => s.state === "done").map((s) => s.step)).toEqual(["booked", "vehicle-received", "inspection"]);
  });

  test("a job that went through awaiting approval shows it done", () => {
    const steps = jobSteps("in-service", [update({ movedTo: "awaiting-approval" }), update({ movedTo: "in-service" })]);
    expect(steps.find((s) => s.step === "awaiting-approval")).toEqual({ step: "awaiting-approval", state: "done" });
  });

  test("a job there now shows it current", () => {
    expect(jobSteps("awaiting-approval", []).find((s) => s.state === "current")?.step).toBe("awaiting-approval");
  });

  test("sent back from Ready to In service: Ready is to come again", () => {
    const steps = jobSteps("in-service", [update({ movedTo: "ready" }), update({ movedTo: "in-service" })]);
    expect(steps.find((s) => s.step === "ready")?.state).toBe("upcoming");
  });

  test("completed: every step done", () => {
    expect(jobSteps("completed", []).every((s) => s.state === "done")).toBe(true);
  });
});

describe("JobTimeline", () => {
  test("not started: the steps with their state in words, and the empty updates line", async () => {
    renderWithIntl(await JobTimeline({ jobStatus: null, updates: [], locale: "en" }));
    expect(shownSteps()).toEqual([
      `${t.steps.booked}${t.states.current}`,
      `${t.steps["vehicle-received"]}${t.states.upcoming}`,
      `${t.steps.inspection}${t.states.upcoming}`,
      `${t.steps["in-service"]}${t.states.upcoming}`,
      `${t.steps.ready}${t.states.upcoming}`,
      `${t.steps.completed}${t.states.upcoming}`,
    ]);
    expect(screen.getByText(t.steps.booked).closest("li")?.getAttribute("aria-current")).toBe("step");
    expect(screen.getByText(t.noUpdates)).toBeTruthy();
  });

  test("updates newest first, headed by the step they moved to or happened during, at India time", async () => {
    const updates = [
      update({ id: "a", movedTo: "vehicle-received", stepAfter: "vehicle-received", createdAt: new Date("2026-11-19T04:00:00Z") }),
      update({ id: "b", stepAfter: "vehicle-received", note: "Checking the brakes", createdAt: new Date("2026-11-19T05:00:00Z") }),
    ];
    renderWithIntl(await JobTimeline({ jobStatus: "vehicle-received", updates, locale: "en" }));
    const list = screen.getByRole("heading", { name: t.updatesHeading }).parentElement!.querySelector("ul")!;
    const headings = within(list).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Update during Vehicle received", "Moved to Vehicle received"]);
    // 05:00 UTC is 10:30 in India.
    expect(list.textContent).toContain("19 Nov 2026, 10:30");
  });

  test("an update before the job started has a plain heading", async () => {
    renderWithIntl(await JobTimeline({ jobStatus: null, updates: [update({ stepAfter: null, note: "We'll collect it at 9" })], locale: "en" }));
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(t.updateBeforeStart);
  });

  test("a note keeps its line breaks and shows markup as text", async () => {
    renderWithIntl(
      await JobTimeline({ jobStatus: "inspection", updates: [update({ note: "Pads worn\n<script>alert(1)</script>" })], locale: "en" }),
    );
    const note = screen.getByText(/Pads worn/);
    expect(note.textContent).toBe("Pads worn\n<script>alert(1)</script>");
    expect(note.className).toContain("whitespace-pre-line");
    expect(document.querySelector("script")).toBeNull();
  });

  test("photos show with alt text from messages; photos the cleanup deleted say so", async () => {
    const withPhotos = update({ id: "p", hadPhotos: true, photos: [{ photoId: "1", url: "/p1.jpg" }, { photoId: "2", url: "/p2.jpg" }] });
    const gone = update({ id: "g", hadPhotos: true, photos: [] });
    renderWithIntl(await JobTimeline({ jobStatus: "inspection", updates: [withPhotos, gone], locale: "en" }));
    const images = screen.getAllByRole("img");
    expect(images.map((img) => img.getAttribute("alt"))).toEqual(["Photo 1 from this update", "Photo 2 from this update"]);
    expect(images[0]!.getAttribute("width")).toBe("400");
    expect(screen.getByText(t.photosGone)).toBeTruthy();
  });

  test("completed: every step reads Done", async () => {
    renderWithIntl(await JobTimeline({ jobStatus: "completed", updates: [], locale: "en" }));
    expect(shownSteps().every((text) => text?.endsWith(t.states.done))).toBe(true);
  });
});
