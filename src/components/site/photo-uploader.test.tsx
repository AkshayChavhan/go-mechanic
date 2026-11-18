import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Activity } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithIntl } from "@/i18n/test-utils";
import { resizePhoto } from "@/lib/resize-photo";

import { PhotoUploader, type PhotoUploaderLabels, type PhotoUploaderProps } from "./photo-uploader";

// Resizing needs a real canvas (e2e/dev/photo-resize.spec.ts checks it):
// here it's a stand-in that answers at once, or fails for "broken.jpg".
vi.mock("@/lib/resize-photo", () => ({ resizePhoto: vi.fn() }));

// Labels that differ from messages/en.json ("T-" in front), so a test that
// finds them proves the uploader shows its labels prop and types no text.
const labels: PhotoUploaderLabels = {
  choose: "T-Add photos",
  hint: "T-Up to {max}",
  tooMany: "T-Only {max}; kept {kept}",
  photoAlt: "T-Photo {n}",
  remove: "T-Remove {n}",
  resizing: "T-Shrinking",
  unreadable: "T-Not a photo",
  upload: "T-Upload",
  uploading: "T-Uploading",
  stored: "T-Uploaded",
  failed: "T-Failed",
  done: "T-{count} uploaded",
  problems: {
    "bad-count": "T-bad count",
    "too-many-photos": "T-too many photos",
    "too-many-sets": "T-too many sets",
    "not-found": "T-not found",
    offline: "T-offline",
  },
};

const setId = "0b6f1a52-2b8e-4c7a-9a5e-1f2d3c4b5a69";
const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
const target = (n: number) => ({ url: `/upload/${n}`, method: "PUT" as const, headers: { "Content-Type": "image/jpeg" } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resizePhoto).mockImplementation(async (file) => {
    if ((file as File).name === "broken.jpg") throw new Error("not an image");
    return { width: 1600, height: 1200, blob: new Blob(["jpeg"], { type: "image/jpeg" }) };
  });
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

/** The two actions and the PUT, answering as a working server would. */
function mocks() {
  const start = vi.fn<PhotoUploaderProps["start"]>().mockImplementation(async ({ count }) => ({
    ok: true,
    setId,
    uploads: ids.slice(0, count).map((photoId, n) => ({ photoId, target: target(n) })),
  }));
  const finish = vi.fn<PhotoUploaderProps["finish"]>().mockImplementation(async (photoIds) =>
    photoIds.map((photoId) => ({ photoId, stored: true })),
  );
  const put = vi.fn<NonNullable<PhotoUploaderProps["put"]>>().mockResolvedValue(true);
  return { start, finish, put };
}

function setup(props: Partial<PhotoUploaderProps> = {}) {
  const { start, finish, put } = mocks();
  const view = renderWithIntl(<PhotoUploader labels={labels} start={start} finish={finish} put={put} {...props} />);
  return { start, finish, put, view };
}

function pick(...names: string[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: names.map((name) => new File(["x"], name, { type: "image/jpeg" })) } });
}

describe("PhotoUploader", () => {
  test("shows its labels: the button and the hint with the limit", () => {
    setup();
    expect(screen.getByRole("button", { name: "T-Add photos" })).toBeTruthy();
    expect(screen.getByText("T-Up to 6")).toBeTruthy();
  });

  test("7 photos picked: the first 6 are kept, with a message", async () => {
    setup();
    pick("1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg", "6.jpg", "7.jpg");
    expect(await screen.findAllByRole("img")).toHaveLength(6);
    expect(screen.getByRole("status").textContent).toBe("T-Only 6; kept 6");
    expect(resizePhoto).toHaveBeenCalledTimes(6);
    expect((screen.getByRole("button", { name: "T-Add photos" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("photos already in the set count toward the 6", async () => {
    setup({ setId, alreadyInSet: 5 });
    expect(screen.getByText("T-Up to 1")).toBeTruthy();
    pick("1.jpg", "2.jpg");
    expect(await screen.findAllByRole("img")).toHaveLength(1);
  });

  test("a file the browser can't read is marked, and takes no place", async () => {
    setup();
    pick("broken.jpg");
    expect(await screen.findByText("T-Not a photo")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "T-Upload" })).toBeNull();
  });

  test("uploads: start, one PUT per photo, then finish with every id, a failed one too", async () => {
    const { start, finish, put } = setup();
    finishWith(finish, [true, false]);
    put.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    pick("1.jpg", "2.jpg");
    await screen.findAllByRole("img");
    fireEvent.click(screen.getByRole("button", { name: "T-Upload" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("T-1 uploaded"));
    expect(start).toHaveBeenCalledWith({ count: 2 });
    expect(put.mock.calls.map(([sent]) => sent.url)).toEqual(["/upload/0", "/upload/1"]);
    expect(finish).toHaveBeenCalledWith(ids);
    expect(screen.getByText("T-Uploaded")).toBeTruthy();
    expect(screen.getByText("T-Failed")).toBeTruthy();
  });

  test("a failed photo is sent again through the link it already has, with no new place", async () => {
    const { start, finish, put } = setup();
    finishWith(finish, [true, false]);
    put.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    pick("1.jpg", "2.jpg");
    await screen.findAllByRole("img");
    fireEvent.click(screen.getByRole("button", { name: "T-Upload" }));
    await screen.findByText("T-Failed");
    // A photo with a place on the server can't be removed, only sent again.
    expect(screen.queryByRole("button", { name: "T-Remove 2" })).toBeNull();

    finishWith(finish, [true], [ids[1]!]);
    fireEvent.click(screen.getByRole("button", { name: "T-Upload" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("T-2 uploaded"));
    expect(start).toHaveBeenCalledTimes(1);
    expect(put.mock.calls.at(-1)![0].url).toBe("/upload/1");
    expect(finish).toHaveBeenLastCalledWith([ids[1]]);
  });

  test("a finish that fails says so, and the photos can be sent again", async () => {
    const { start, finish } = setup();
    finish.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    pick("1.jpg", "2.jpg");
    await screen.findAllByRole("img");
    fireEvent.click(screen.getByRole("button", { name: "T-Upload" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("T-offline"));
    expect(screen.getAllByText("T-Failed")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "T-Upload" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("T-2 uploaded"));
    expect(start).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenLastCalledWith(ids);
  });

  test("hidden and shown again (as Next.js does with a page you leave), the thumbnails get fresh links", async () => {
    const { start, finish, put } = mocks();
    // Plain render: renderWithIntl's rerender would drop its provider and
    // remount the whole tree. The uploader reads no messages itself.
    const view = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <PhotoUploader labels={labels} start={start} finish={finish} put={put} />
      </Activity>
    );
    const { rerender, unmount } = render(view("visible"));
    pick("1.jpg");
    await screen.findByRole("img");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    rerender(view("hidden"));
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    rerender(view("visible"));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(document.querySelector("img")!.getAttribute("src")).toBe("blob:preview");
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
  test("a refusal from the server shows its message, and nothing is uploaded", async () => {
    const { start, put } = setup();
    start.mockResolvedValueOnce({ ok: false, problem: "too-many-sets" });
    pick("1.jpg");
    await screen.findByRole("img");
    fireEvent.click(screen.getByRole("button", { name: "T-Upload" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("T-too many sets"));
    expect(put).not.toHaveBeenCalled();
  });

  test("no connection: the offline message", async () => {
    const { start } = setup();
    start.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    pick("1.jpg");
    await screen.findByRole("img");
    fireEvent.click(screen.getByRole("button", { name: "T-Upload" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("T-offline"));
  });

  test("with a name, a hidden field posts the set id after the first upload", async () => {
    const { finish } = setup({ name: "photoSet" });
    finishWith(finish, [true]);
    expect(document.querySelector('input[name="photoSet"]')).toBeNull();
    pick("1.jpg");
    await screen.findByRole("img");
    fireEvent.click(screen.getByRole("button", { name: "T-Upload" }));
    await screen.findByText("T-Uploaded");
    expect(document.querySelector<HTMLInputElement>('input[name="photoSet"]')!.value).toBe(setId);
  });

  test("a photo can be removed before it's uploaded", async () => {
    setup();
    pick("1.jpg");
    await screen.findByRole("img");
    fireEvent.click(screen.getByRole("button", { name: "T-Remove 1" }));
    expect(screen.queryByRole("img")).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });
});

/** Makes `finish` answer stored or not for each id, in order. */
function finishWith(finish: ReturnType<typeof vi.fn<PhotoUploaderProps["finish"]>>, stored: boolean[], photoIds = ids) {
  finish.mockResolvedValueOnce(stored.map((isStored, n) => ({ photoId: photoIds[n]!, stored: isStored })));
}
