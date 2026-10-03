import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getDb, nowIso, type Db } from "./db";

export const SESSION_COOKIE = "session";
const ONE_YEAR_S = 365 * 24 * 60 * 60;

export interface Learner {
  id: number;
  username: string;
  email: string;
  display_name: string;
  level: "A1" | "A2" | "B1" | "B2";
  difficulty_min: number;
  difficulty_max: number;
  voice_pref: string;
  external_voice_enabled: number;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(String(body.message ?? body.error));
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json(e.body, { status: e.status });
  console.error(e);
  return Response.json(
    { error: "server_error", message: "Something went wrong on our side. Please try again." },
    { status: 500 },
  );
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

const LEARNER_COLUMNS =
  "id, username, email, display_name, level, difficulty_min, difficulty_max, voice_pref, external_voice_enabled";

export function findLearnerByIdentifier(identifier: string, db: Db = getDb()) {
  const id = identifier.trim().toLowerCase();
  return db
    .prepare(`SELECT ${LEARNER_COLUMNS}, password_hash FROM learners WHERE username = ? OR email = ?`)
    .get(id, id) as (Learner & { password_hash: string }) | undefined;
}

export function getLearner(id: number, db: Db = getDb()): Learner {
  return db.prepare(`SELECT ${LEARNER_COLUMNS} FROM learners WHERE id = ?`).get(id) as unknown as Learner;
}

export async function createSession(learnerId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  const created = new Date();
  const expires = new Date(created.getTime() + ONE_YEAR_S * 1000);
  getDb()
    .prepare("INSERT INTO auth_sessions (token_hash, learner_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(sha256(token), learnerId, created.toISOString(), expires.toISOString());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_S,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) getDb().prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(sha256(token));
  jar.delete(SESSION_COOKIE);
}

/** Current learner from the session cookie, or null. */
export async function currentLearner(): Promise<Learner | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare("SELECT learner_id FROM auth_sessions WHERE token_hash = ? AND expires_at > ?")
    .get(sha256(token), nowIso()) as { learner_id: number } | undefined;
  return row ? getLearner(row.learner_id) : null;
}

/** Route guard: returns the learner or throws a 401. */
export async function requireLearner(): Promise<Learner> {
  const learner = await currentLearner();
  if (!learner) throw new HttpError(401, { error: "unauthorized", message: "Please sign in again." });
  return learner;
}
