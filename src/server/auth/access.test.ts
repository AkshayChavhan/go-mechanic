import { inspect } from "node:util";

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Role } from "@/domain/roles";

import { AccessDeniedError, authorize, authorizeUser, requirePermission, requireUser } from "./access";
import { getCurrentUser } from "./session";

// getCurrentUser() reads the session cookie; here a stand-in answers with
// the user each test needs.
vi.mock("./session", () => ({ getCurrentUser: vi.fn() }));

const userWith = (role: Role) => ({ id: "u1", phoneNumber: "+919876543210", role });

/** What a call threw (a redirect or a 404 is a thrown error with a digest). */
async function thrownBy(run: Promise<unknown>): Promise<unknown> {
  return run.then(
    () => "nothing thrown",
    (error: unknown) => error,
  );
}

const TO_LOGIN = { digest: expect.stringMatching(/^NEXT_REDIRECT;\w+;\/login\?session=ended;/) };
const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
});

describe("requireUser (pages and Server Actions)", () => {
  test("logged in: the user, as getCurrentUser gave it", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("customer"));
    expect(await requireUser("en")).toEqual(userWith("customer"));
  });

  test("logged out: to /login?session=ended", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(requireUser("en"))).toMatchObject(TO_LOGIN);
  });
});

describe("requirePermission (pages and Server Actions)", () => {
  test("with the permission: the user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("owner"));
    expect(await requirePermission("en", "garage.edit")).toEqual(userWith("owner"));
  });

  test("logged in without it: the 404 page", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("customer"));
    expect(await thrownBy(requirePermission("en", "admin.open"))).toMatchObject(NOT_FOUND);
  });

  test("logged out: the redirect to /login, not the 404", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(requirePermission("en", "admin.open"))).toMatchObject(TO_LOGIN);
  });
});

describe("authorize (the data-access layer's check)", () => {
  test.each(["owner", "manager"] as const)("a %s may edit the garage", async (role) => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith(role));
    expect(await authorize("garage.edit")).toEqual(userWith(role));
  });

  test.each(["mechanic", "customer"] as const)("a %s may not: AccessDeniedError (notAllowed)", async (role) => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith(role));
    const error = await thrownBy(authorize("garage.edit"));
    expect(error).toBeInstanceOf(AccessDeniedError);
    expect(error).toMatchObject({ reason: "notAllowed", permission: "garage.edit" });
  });

  test("logged out: AccessDeniedError (signedOut)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await thrownBy(authorize("garage.edit"))).toMatchObject({ reason: "signedOut" });
  });

  test("the error names the permission, never the person", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("customer"));
    const error = await thrownBy(authorize("team.manage"));
    expect((error as Error).message).toBe("Access denied (notAllowed: team.manage)");
    expect(inspect(error)).not.toMatch(/9876543210|u1/);
  });
});

describe("authorizeUser (the data-access layer's check for a customer's own data)", () => {
  test("a logged-in customer: the user (customers hold no permission, and need none here)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(userWith("customer"));
    expect(await authorizeUser()).toEqual(userWith("customer"));
  });

  test("logged out: AccessDeniedError (signedOut), naming no permission and no person", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const error = await thrownBy(authorizeUser());
    expect(error).toBeInstanceOf(AccessDeniedError);
    expect(error).toMatchObject({ reason: "signedOut", permission: null });
    expect((error as Error).message).toBe("Access denied (signedOut)");
  });
});
