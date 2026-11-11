import { act, fireEvent, render, screen } from "@testing-library/react";
import { Activity } from "react";
import { describe, expect, test, vi } from "vitest";

import { initialNameFormState, type NameFormState } from "@/lib/account-forms";
import messages from "../../../messages/en.json";

import { NameForm, nameSubmitter, type NameAction, type NameFormLabels } from "./name-form";

// The form's words come from the page as props: here, the real Account
// messages. The Server Action is a stand-in (vi.fn) answering what each test
// needs (src/server/actions/account.test.ts tests the real one).

const t = messages.Account;
const labels: NameFormLabels = {
  heading: t.nameHeading,
  note: t.nameNote,
  label: t.nameLabel,
  submit: t.nameSubmit,
  saving: t.saving,
  connection: messages.Login.errors.connection,
};

const nameField = () => screen.getByLabelText(t.nameLabel) as HTMLInputElement;

/** Types a name and presses "Save name", waiting for the answer to show. */
async function send(typed: string) {
  fireEvent.change(nameField(), { target: { value: typed } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: t.nameSubmit }));
  });
}

describe("NameForm", () => {
  test("a heading, why the name is asked, and an empty name field that browsers can fill in", () => {
    render(<NameForm action={vi.fn<NameAction>()} labels={labels} />);
    expect(screen.getByRole("heading", { level: 2, name: t.nameHeading })).toBeTruthy();
    expect(screen.getByText(t.nameNote)).toBeTruthy();
    expect(nameField().value).toBe("");
    expect(nameField().getAttribute("name")).toBe("name");
    expect(nameField().getAttribute("autocomplete")).toBe("name");
    expect(nameField().required).toBe(true);
  });

  test("an error shows under the field, marks it invalid, keeps what was typed and puts the cursor back", async () => {
    const answer: NameFormState = { submission: 1, nameTyped: "A", error: t.nameErrors["name-too-short"] };
    const action = vi.fn<NameAction>().mockResolvedValue(answer);
    render(<NameForm action={action} labels={labels} />);
    await send("A");

    expect(Object.fromEntries(action.mock.calls[0][1].entries())).toEqual({ name: "A" });
    const error = screen.getByText(t.nameErrors["name-too-short"]);
    expect(nameField().value).toBe("A");
    expect(nameField().getAttribute("aria-invalid")).toBe("true");
    expect(nameField().getAttribute("aria-describedby")).toBe(error.id);
    expect(document.activeElement).toBe(nameField());
  });

  test("leaving /account and coming back after an error: an empty form, no old error, and the cursor left alone", async () => {
    const answer: NameFormState = { submission: 1, nameTyped: "A", error: t.nameErrors["name-too-short"] };
    const action = vi.fn<NameAction>().mockResolvedValue(answer);
    const page = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <NameForm action={action} labels={labels} />
      </Activity>
    );
    const { rerender } = render(page("visible"));
    await send("A");
    expect(screen.getByText(t.nameErrors["name-too-short"])).toBeTruthy();
    (document.activeElement as HTMLElement).blur();

    rerender(page("hidden"));
    rerender(page("visible"));
    expect(nameField().value).toBe("");
    expect(screen.queryByText(t.nameErrors["name-too-short"])).toBeNull();
    expect(document.activeElement).not.toBe(nameField());
  });

  test("another customer (a new key) gets an empty form, not the last one's draft", () => {
    const { rerender } = render(<NameForm key="asha" action={vi.fn<NameAction>()} labels={labels} />);
    fireEvent.change(nameField(), { target: { value: "Asha" } });
    rerender(<NameForm key="ravi" action={vi.fn<NameAction>()} labels={labels} />);
    expect(nameField().value).toBe("");
  });
});

describe("nameSubmitter (what useActionState runs)", () => {
  const form = (name: string) => {
    const data = new FormData();
    data.set("name", name);
    return data;
  };

  test("a saved name's redirect is passed on to Next.js, not turned into an error", async () => {
    // What the browser receives when the action calls redirect(): a rejected
    // call whose digest names the redirect.
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/account;303;" });
    const submit = nameSubmitter(vi.fn<NameAction>().mockRejectedValue(redirect), "No connection");
    await expect(submit(initialNameFormState, form("Asha"))).rejects.toBe(redirect);
  });

  test("a failed call keeps what was typed and says so", async () => {
    const submit = nameSubmitter(vi.fn<NameAction>().mockRejectedValue(new TypeError("Failed to fetch")), "No connection");
    expect(await submit({ ...initialNameFormState, submission: 2 }, form("Asha"))).toEqual({
      submission: 3,
      nameTyped: "Asha",
      error: "No connection",
    });
  });
});
