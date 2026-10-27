// Turns a stored phone number into what the site shows and links to.
//
// Numbers are stored in E.164 form: "+", the country code (91 for India),
// then the number with no spaces: "+919764750567".
//
// Two kinds of helpers live here:
// - Display and link helpers (formatPhoneNumber, telHref, whatsappHref) run
//   while a page renders, so they never throw. A number they can't read is
//   still shown or dialled as stored.
// - Checks (isIndianPhoneNumber, isIndianMobileNumber) run when a number is
//   saved: garage.test.ts today, the admin screens later (tasks 28 and 40).

// +91, then 10 digits. The number never starts with 0: that's only the
// "trunk" prefix people dial inside India (09764...), not part of the number.
const INDIAN_NUMBER = /^\+91[1-9]\d{9}$/;
// Indian mobile numbers start with 6, 7, 8 or 9. Landlines start with an area
// code instead (20 for Pune, 22 for Mumbai...).
const INDIAN_MOBILE = /^\+91[6-9]\d{9}$/;

/** Any Indian number (mobile or landline) in E.164 form. For the number visitors call. */
export function isIndianPhoneNumber(number: string): boolean {
  return INDIAN_NUMBER.test(number);
}

/** An Indian mobile number in E.164 form. WhatsApp needs one. */
export function isIndianMobileNumber(number: string): boolean {
  return INDIAN_MOBILE.test(number);
}

/**
 * The number as people read it: "+919764750567" -> "+91 97647 50567"
 * (5 + 5 digits, the usual way to write an Indian mobile). Landlines and
 * foreign numbers have no single grouping, so they're shown as stored.
 */
export function formatPhoneNumber(number: string): string {
  if (!isIndianMobileNumber(number)) return number;
  return `+91 ${number.slice(3, 8)} ${number.slice(8)}`;
}

/** The link that dials the number on a phone: "tel:+919764750567". */
export function telHref(number: string): string {
  // Keep only "+" and digits, in case a space or dash slipped into the stored number.
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}

/**
 * The link that opens a WhatsApp chat with `message` already typed in:
 * "https://wa.me/919764750567?text=Hi%2C%20I'd%20like...".
 * Open it in a new tab: on a computer it goes to WhatsApp's website.
 */
export function whatsappHref(number: string, message: string): string {
  // wa.me wants the number as digits only: no "+", no spaces.
  const digits = number.replace(/\D/g, "");
  // encodeURIComponent turns a space into %20 and a new line into %0A, the
  // same encoding WhatsApp's own wa.me examples use.
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
