// PUT /api/photos/upload?t=…: the fake photo storage's upload link (task 30).
// Only for local runs: with Supabase Storage the browser uploads to Supabase,
// and this address answers 404.

import "server-only";

import { handleFakeUpload } from "@/server/providers/photos/fake";
import { fakePhotoOptions } from "@/server/providers/photos";

export async function PUT(request: Request): Promise<Response> {
  const options = fakePhotoOptions();
  if (!options) return new Response(null, { status: 404 });
  return handleFakeUpload(request, options);
}
