// Reading a form field as text, shared by the Server Actions and the booking
// wizard's form helpers. A plain module (no "server-only"), so the browser can use it too.

/** A form field's text, or "" when it's missing (or a file). */
export function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
