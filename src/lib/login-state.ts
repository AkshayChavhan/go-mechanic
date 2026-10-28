// What the login form shows: the state its Server Action (src/server/actions/
// login.ts) returns after each step, and the form (LoginForm) keeps and
// sends back. It lives here because a "use server" file may only export
// async functions, and the browser needs initialLoginState too.

export type LoginState = {
  step: "phone" | "code";
  /** What was typed and ticked, kept when the form comes back with an error. */
  phoneTyped: string;
  ageConfirmed: boolean;
  contactConsent: boolean;
  /** The code step's login attempt (a hidden field in the form). */
  attemptId?: string;
  /** "+91 98765 43210": where the code went. */
  phoneDisplay?: string;
  /** When "Send a new code" works again (ISO time). */
  resendAt?: string;
  /** Said when the code step opens: where the code went. */
  status?: string;
  /** Which field the error belongs to, and what it says. */
  error?: { field: "phone" | "consent" | "code" | "form"; text: string };
  /** For "please wait" errors: when to try again (ISO time); the form counts down to it. */
  retryAt?: string;
};

export const initialLoginState: LoginState = {
  step: "phone",
  phoneTyped: "",
  ageConfirmed: false,
  contactConsent: false,
};
