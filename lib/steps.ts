export const STEPS = ["learn", "speak_try1", "speak_try2", "write", "read_aloud", "done"] as const;
export type Step = (typeof STEPS)[number];
export type Phase = "try1" | "try2" | "read";
export type ItemKind = "idiom" | "example" | "corrected";

/** What the guards need to know about a session (computed from the DB by the caller). */
export interface StepFacts {
  step: Step;
  hasExamples: boolean;
  counted: { try1: number; try2: number; read: number };
  gradedSentences: number;
}

export type Advance = { ok: true } | { ok: false; message: string };

export const isStep = (s: unknown): s is Step => typeof s === "string" && (STEPS as readonly string[]).includes(s);

/** Speak tries are for the idiom + examples; read-aloud is for corrected sentences. */
export function isPhaseAllowed(kind: ItemKind, phase: Phase): boolean {
  if (phase === "read") return kind === "corrected";
  return kind === "idiom" || kind === "example";
}

/** Forward-only, one step at a time, with the guards from data-model.md. */
export function canAdvance(facts: StepFacts, to: Step): Advance {
  const from = STEPS.indexOf(facts.step);
  const target = STEPS.indexOf(to);
  if (target !== from + 1) {
    return { ok: false, message: "Let's go one step at a time." };
  }
  switch (to) {
    case "speak_try1":
      return facts.hasExamples ? { ok: true } : { ok: false, message: "Your examples are still on the way – one moment!" };
    case "speak_try2":
      return facts.counted.try1 >= 4 ? { ok: true } : { ok: false, message: "Please finish all 4 recordings first." };
    case "write":
      return facts.counted.try2 >= 4 ? { ok: true } : { ok: false, message: "Please finish all 4 recordings first." };
    case "read_aloud":
      return facts.gradedSentences >= 3
        ? { ok: true }
        : { ok: false, message: "Please get all 3 sentences graded first." };
    case "done":
      return facts.counted.read >= 3 ? { ok: true } : { ok: false, message: "Please read all 3 sentences first." };
    default:
      return { ok: false, message: "Let's go one step at a time." };
  }
}
