import { getSettings } from "../config";

export class TutorOfflineError extends Error {
  constructor(cause?: unknown) {
    super("The tutor (Ollama) is not reachable");
    this.cause = cause;
  }
}

export class TutorInvalidError extends Error {
  constructor(public reason: string) {
    super(`Tutor answer was not valid: ${reason}`);
  }
}

export type Validation<T> = { ok: true; value: T } | { ok: false; reason: string };

export interface ChatJsonArgs<T> {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  validate: (raw: unknown) => Validation<T>;
}

async function callOllama(messages: { role: string; content: string }[], schema: Record<string, unknown>) {
  const { llm } = getSettings();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), llm.timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${llm.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: llm.model,
        stream: false,
        think: false,
        keep_alive: llm.keepAlive,
        options: { temperature: llm.temperature },
        format: schema,
        messages,
      }),
    });
  } catch (e) {
    throw new TutorOfflineError(e);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new TutorOfflineError(new Error(`Ollama HTTP ${res.status}: ${await res.text()}`));
  const body = (await res.json()) as { message?: { content?: string } };
  return body.message?.content ?? "";
}

/**
 * Schema-constrained chat with code validation. Retries once with a reminder naming the
 * broken rule, then throws TutorInvalidError. Throws TutorOfflineError on connection/timeout.
 */
export async function chatJson<T>({ system, user, schema, validate }: ChatJsonArgs<T>): Promise<T> {
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  let reason = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = await callOllama(messages, schema);
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      reason = "the answer was not valid JSON";
      parsed = undefined;
    }
    if (parsed !== undefined) {
      const v = validate(parsed);
      if (v.ok) return v.value;
      reason = v.reason;
    }
    messages.push(
      { role: "assistant", content },
      { role: "user", content: `Your last answer broke this rule: ${reason}. Follow the JSON schema exactly.` },
    );
  }
  throw new TutorInvalidError(reason);
}

export async function pingOllama(): Promise<boolean> {
  const { llm } = getSettings();
  try {
    const res = await fetch(`${llm.baseUrl}/api/version`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}
