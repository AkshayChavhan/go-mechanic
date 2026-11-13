// GET /api/photos/view?t=…: the fake photo storage's view link (task 30).
// Only for local runs: with Supabase Storage view links go to Supabase, and
// this address answers 404.

import "server-only";

import { handleFakeView } from "@/server/providers/photos/fake";
import { fakePhotoOptions } from "@/server/providers/photos";

export async function GET(request: Request): Promise<Response> {
  const options = fakePhotoOptions();
  if (!options) return new Response(null, { status: 404 });
  return handleFakeView(request, options);
}
