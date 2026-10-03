import { createSession, errorResponse, findLearnerByIdentifier, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

const BAD = { error: "bad_credentials", message: "Username/email or password is not right." };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { identifier?: unknown; password?: unknown };
    const identifier = typeof body.identifier === "string" ? body.identifier : "";
    const password = typeof body.password === "string" ? body.password : "";
    const learner = identifier && password ? findLearnerByIdentifier(identifier) : undefined;
    // Same response whichever field was wrong (no hint).
    if (!learner || !verifyPassword(password, learner.password_hash)) {
      return Response.json(BAD, { status: 401 });
    }
    await createSession(learner.id);
    return Response.json({ displayName: learner.display_name });
  } catch (e) {
    return errorResponse(e);
  }
}
