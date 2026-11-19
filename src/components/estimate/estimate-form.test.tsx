import { act, fireEvent, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { Activity, type ReactElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { PhotoUploaderLabels, PhotoUploaderProps } from "@/components/site/photo-uploader";
import type { VehiclePickerLabels } from "@/components/site/vehicle-picker";
import type { VehicleCatalogue } from "@/domain/vehicles";
import { defaultLocale, GARAGE_TIME_ZONE } from "@/i18n/config";
import { renderWithIntl } from "@/i18n/test-utils";
import type { EstimateFormState } from "@/lib/estimate-form";
import { resizePhoto } from "@/lib/resize-photo";
import messages from "../../../messages/en.json";

import { type EstimateAction, EstimateForm, type EstimateFormLabels, type SavedVehicleChoice } from "./estimate-form";

// The form's words come from the page as props: here, the real messages. The
// Server Action and the photo actions are stand-ins (vi.fn) answering what
// each test needs (src/server/actions/estimates.test.ts tests the real one).
// Resizing needs a real canvas: here it answers at once.
vi.mock("@/lib/resize-photo", () => ({ resizePhoto: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resizePhoto).mockResolvedValue({ width: 1600, height: 1200, blob: new Blob(["jpeg"], { type: "image/jpeg" }) });
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

const t = messages.EstimatePage;
const v = messages.Vehicles;
const p = messages.Photos.uploader;
const labels: EstimateFormLabels = {
  vehicleLegend: t.vehicleLegend,
  otherVehicle: t.otherVehicle,
  descriptionLabel: t.descriptionLabel,
  descriptionHint: t.descriptionHint,
  descriptionCount: t.descriptionCount,
  photosLegend: t.photosLegend,
  photosHint: t.photosHint,
  submit: t.submit,
  sending: t.sending,
  waitingForPhotos: t.waitingForPhotos,
  connection: messages.Login.errors.connection,
};
const pickerLabels: VehiclePickerLabels = {
  kindLegend: v.picker.kindLegend,
  kinds: { car: v.kinds.car, "two-wheeler": v.kinds.twoWheeler },
  makeLabel: v.picker.makeLabel,
  makePlaceholder: v.picker.makePlaceholder,
  makeGroups: { car: v.picker.makeGroups.car, "two-wheeler": v.picker.makeGroups.twoWheeler },
  modelLabel: v.picker.modelLabel,
  modelPlaceholder: v.picker.modelPlaceholder,
  modelGroup: v.picker.modelGroup,
  fuelLegend: v.picker.fuelLegend,
  fuels: v.fuels,
  announceSet: v.picker.announceSet,
  announceCleared: v.picker.announceCleared,
};
const photoLabels: PhotoUploaderLabels = { ...p, problems: p.problems };

const catalogue: VehicleCatalogue = {
  categories: [{ id: "sedan", kind: "car", name: { en: "Sedan" } }],
  makes: [
    {
      id: "car-honda",
      kind: "car",
      name: { en: "Honda" },
      models: [{ id: "car-honda-city", name: { en: "City" }, categoryId: "sedan", fuels: ["petrol", "diesel"] }],
    },
  ],
};

const SAVED = "11111111-2222-4333-8444-555555555555";
const saved: SavedVehicleChoice[] = [{ id: SAVED, label: "Honda City · MH 12 AB 1234" }];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const SET = "0b6f1a52-2b8e-4c7a-9a5e-1f2d3c4b5a69";
const PHOTO = "11111111-1111-4111-8111-111111111111";

/** The photo actions and the PUT, answering as a working server would. */
function photoMocks() {
  const start = vi.fn<PhotoUploaderProps["start"]>().mockResolvedValue({
    ok: true,
    setId: SET,
    uploads: [{ photoId: PHOTO, target: { url: "/upload/0", method: "PUT", headers: {} } }],
  });
  const finish = vi.fn<PhotoUploaderProps["finish"]>().mockResolvedValue([{ photoId: PHOTO, stored: true }]);
  return { start, finish };
}

function form(action: EstimateAction, savedVehicles: readonly SavedVehicleChoice[] = saved) {
  const { start, finish } = photoMocks();
  return (
    <EstimateForm
      action={action}
      savedVehicles={savedVehicles}
      catalogue={catalogue}
      labels={labels}
      pickerLabels={pickerLabels}
      photoLabels={photoLabels}
      startPhotos={start}
      finishPhotos={finish}
    />
  );
}

/** The form inside an <Activity>, as Next.js shows a page. */
function formIn(mode: "visible" | "hidden", action: EstimateAction) {
  return <Activity mode={mode}>{form(action)}</Activity>;
}

/** The provider renderWithIntl wraps around a first render, for rerenders. */
function withIntl(ui: ReactElement) {
  return (
    <NextIntlClientProvider locale={defaultLocale} messages={messages} timeZone={GARAGE_TIME_ZONE}>
      {ui}
    </NextIntlClientProvider>
  );
}

const description = () => screen.getByLabelText(t.descriptionLabel) as HTMLTextAreaElement;
const send = () => screen.getByRole("button", { name: t.submit }) as HTMLButtonElement;
const modelField = () => screen.queryByRole("combobox", { name: v.picker.modelLabel });

async function submit() {
  await act(async () => {
    fireEvent.click(send());
  });
}

/** What the action got on its `call`-th call. */
function posted(action: ReturnType<typeof vi.fn<EstimateAction>>, call = 0) {
  return Object.fromEntries(action.mock.calls[call]![1].entries());
}

const withErrors: EstimateFormState = {
  submission: 1,
  values: { vehicleChoice: SAVED, modelId: "", fuel: "", description: "Noise" },
  errors: { description: t.errors["description-too-short"] },
};

describe("EstimateForm", () => {
  test("with saved vehicles: they are choices, with Another vehicle, and the picker shows only for that", () => {
    renderWithIntl(form(vi.fn<EstimateAction>()));
    expect(screen.getByRole("radio", { name: saved[0]!.label })).toBeTruthy();
    expect(modelField()).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: t.otherVehicle }));
    expect(modelField()).not.toBeNull();
  });

  test("with no saved vehicles: only the picker", () => {
    renderWithIntl(form(vi.fn<EstimateAction>(), []));
    expect(screen.queryByRole("radio", { name: t.otherVehicle })).toBeNull();
    expect(modelField()).not.toBeNull();
  });

  test("the description has its hint and a count of characters", () => {
    renderWithIntl(form(vi.fn<EstimateAction>()));
    expect(description().required).toBe(true);
    expect(screen.getByText(t.descriptionHint)).toBeTruthy();
    expect(screen.getByText("0 of 1000 characters")).toBeTruthy();
    fireEvent.change(description(), { target: { value: "  Squeal  " } });
    expect(screen.getByText("6 of 1000 characters")).toBeTruthy();
  });

  test("sends the choice, the description and a request token; a retry reuses the token", async () => {
    const action = vi.fn<EstimateAction>().mockResolvedValue(withErrors);
    renderWithIntl(form(action));
    fireEvent.click(screen.getByRole("radio", { name: saved[0]!.label }));
    fireEvent.change(description(), { target: { value: "Noise" } });
    await submit();
    expect(posted(action)).toMatchObject({ vehicleChoice: SAVED, description: "Noise" });
    expect(posted(action).requestToken).toMatch(UUID);

    await submit();
    expect(posted(action, 1).requestToken).toBe(posted(action).requestToken);
  });

  test("after an error, what was posted stays, the error sits under its field and the cursor goes there", async () => {
    renderWithIntl(form(vi.fn<EstimateAction>().mockResolvedValue(withErrors)));
    fireEvent.click(screen.getByRole("radio", { name: saved[0]!.label }));
    fireEvent.change(description(), { target: { value: "Noise" } });
    await submit();
    expect((screen.getByRole("radio", { name: saved[0]!.label }) as HTMLInputElement).checked).toBe(true);
    expect(description().value).toBe("Noise");
    const error = screen.getByText(t.errors["description-too-short"]);
    expect(description().getAttribute("aria-invalid")).toBe("true");
    expect(description().getAttribute("aria-describedby")).toContain(error.id);
    expect(document.activeElement).toBe(description());
  });

  test("a failed call keeps everything and says so", async () => {
    renderWithIntl(form(vi.fn<EstimateAction>().mockRejectedValue(new TypeError("Failed to fetch"))));
    fireEvent.change(description(), { target: { value: "Brakes squeal" } });
    await submit();
    expect(screen.getByText(messages.Login.errors.connection)).toBeTruthy();
    expect(description().value).toBe("Brakes squeal");
  });

  test("Send waits while a photo is picked but not uploaded, and says why", async () => {
    renderWithIntl(form(vi.fn<EstimateAction>()));
    expect(send().disabled).toBe(false);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["x"], "1.jpg", { type: "image/jpeg" })] } });
    });
    expect(send().disabled).toBe(true);
    const hint = screen.getByText(t.waitingForPhotos);
    expect(send().getAttribute("aria-describedby")).toBe(hint.id);
    // The uploader's own button is grey here: Send is the form's blue button.
    expect(screen.getByRole("button", { name: p.upload }).dataset.variant).toBe("secondary");

    fireEvent.click(screen.getByRole("button", { name: "Remove photo 1" }));
    expect(send().disabled).toBe(false);
    expect(screen.queryByText(t.waitingForPhotos)).toBeNull();
  });

  test("an error answer keeps the uploaded photos, and the retry posts the same photo set", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 })) as typeof fetch;
    const action = vi.fn<EstimateAction>().mockResolvedValue(withErrors);
    renderWithIntl(form(action));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["x"], "1.jpg", { type: "image/jpeg" })] } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: p.upload }));
    });
    await screen.findByText(p.stored);
    fireEvent.change(description(), { target: { value: "Noise" } });
    await submit();
    expect(posted(action).photoSetId).toBe(SET);
    // The fields remounted with the error; the photo is still there, stored.
    expect(screen.getByText(t.errors["description-too-short"])).toBeTruthy();
    expect(screen.getByText(p.stored)).toBeTruthy();
    await submit();
    expect(posted(action, 1).photoSetId).toBe(SET);
  });

  test("keeps a saved vehicle tapped before the page's JavaScript loaded", async () => {
    // The server's HTML is in the page, the customer taps a choice, and only
    // then does React hydrate it: the choice must survive, in what's shown
    // and in what the form posts.
    const tree: ReactElement = withIntl(form(vi.fn<EstimateAction>()));
    const container = document.createElement("div");
    container.innerHTML = renderToString(tree);
    document.body.append(container);
    const other = within(container).getByRole("radio", { name: t.otherVehicle }) as HTMLInputElement;
    other.checked = true;

    // React reports a hydration mismatch with console.error.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, tree);
    });
    try {
      expect(consoleError).not.toHaveBeenCalled();
      expect((within(container).getByRole("radio", { name: t.otherVehicle }) as HTMLInputElement).checked).toBe(true);
      // "Another vehicle" shows the picker.
      expect(within(container).queryByRole("combobox", { name: v.picker.modelLabel })).not.toBeNull();
    } finally {
      consoleError.mockRestore();
      act(() => root?.unmount());
      container.remove();
    }
  });

  test("leaving the page and coming back starts it empty, with a new token", async () => {
    const action = vi.fn<EstimateAction>().mockResolvedValue(withErrors);
    const { rerender } = renderWithIntl(formIn("visible", action));
    fireEvent.change(description(), { target: { value: "Noise" } });
    await submit();
    rerender(withIntl(formIn("hidden", action)));
    rerender(withIntl(formIn("visible", action)));
    expect(description().value).toBe("");
    expect(screen.queryByText(t.errors["description-too-short"])).toBeNull();
    fireEvent.change(description(), { target: { value: "Brakes squeal" } });
    await submit();
    expect(posted(action, 1).requestToken).not.toBe(posted(action).requestToken);
  });
});
