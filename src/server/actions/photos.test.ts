import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCurrentUser } from "@/server/auth/session";
import { finishPhotoUpload, startPhotoUpload } from "@/server/dal/photos";

import { finishPhotos, startPhotos } from "./photos";

// The actions only check their input and call the data-access layer, which
// is tested on its own and replaced here. requireUser is the real one,
// reading a mocked session.
vi.mock("@/server/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/server/dal/photos", () => ({ startPhotoUpload: vi.fn(), finishPhotoUpload: vi.fn() }));

const asha = { id: "asha", phoneNumber: "+919876500001", role: "customer" as const };
const setId = "0b6f1a52-2b8e-4c7a-9a5e-1f2d3c4b5a69";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(asha);
  vi.mocked(startPhotoUpload).mockResolvedValue({ ok: true, setId, uploads: [] });
  vi.mocked(finishPhotoUpload).mockResolvedValue([]);
});

const toLogin = { digest: expect.stringMatching(/^NEXT_REDIRECT;replace;\/login\?session=ended;/) };

describe("startPhotos", () => {
  test("logged out: a redirect to /login, and nothing is started", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(startPhotos("en", { count: 1 })).rejects.toMatchObject(toLogin);
    expect(startPhotoUpload).not.toHaveBeenCalled();
  });

  test("an unknown locale throws before anything else", async () => {
    await expect(startPhotos("xx", { count: 1 })).rejects.toThrow("Unknown locale");
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  test("passes on only the set id and the count: a posted userId does nothing", async () => {
    await startPhotos("en", { setId, count: 2, userId: "ravi" });
    expect(startPhotoUpload).toHaveBeenCalledWith({ setId, count: 2 });
    await startPhotos("en", { count: 1 });
    expect(startPhotoUpload).toHaveBeenLastCalledWith({ count: 1 });
  });

  test("a missing or odd count is bad-count; a set id that isn't text is not-found", async () => {
    expect(await startPhotos("en", null)).toEqual({ ok: false, problem: "bad-count" });
    expect(await startPhotos("en", { count: "3" })).toEqual({ ok: false, problem: "bad-count" });
    expect(await startPhotos("en", { setId: 5, count: 1 })).toEqual({ ok: false, problem: "not-found" });
    expect(startPhotoUpload).not.toHaveBeenCalled();
  });
});

describe("finishPhotos", () => {
  test("logged out: a redirect to /login", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(finishPhotos("en", [setId])).rejects.toMatchObject(toLogin);
    expect(finishPhotoUpload).not.toHaveBeenCalled();
  });

  test("passes on at most 6 text ids, and nothing for anything but a list", async () => {
    await finishPhotos("en", ["a", 2, "b", "c", "d", "e", "f", "g"]);
    expect(finishPhotoUpload).toHaveBeenCalledWith(["a", "b", "c", "d", "e", "f"]);
    expect(await finishPhotos("en", "a")).toEqual([]);
  });
});
