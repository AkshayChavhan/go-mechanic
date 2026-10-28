// Who someone is at the garage. Everyone who logs in starts as a customer;
// task 16 decides what each role may do and how the owner's number becomes
// "owner".

/** Every role, from the least to the most access. */
export const ROLES = ["customer", "mechanic", "manager", "owner"] as const;

export type Role = (typeof ROLES)[number];
