// Row ids made at runtime (vehicles, bookings, login attempts) are uuids.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether `id` is a uuid. Postgres refuses to compare a uuid column with
 * anything else (error 22P02), so a made-up id ("1; drop", "abc") would
 * crash the query instead of being "not found": check first.
 */
export function isUuid(id: string): boolean {
  return UUID.test(id);
}
