import { destroySession, errorResponse } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await destroySession();
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
