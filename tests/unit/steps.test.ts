import { describe, expect, it } from "vitest";
import { canAdvance, isPhaseAllowed, type StepFacts } from "@/lib/steps";

const facts = (over: Partial<StepFacts> = {}): StepFacts => ({
  step: "learn",
  hasExamples: true,
  counted: { try1: 0, try2: 0, read: 0 },
  gradedSentences: 0,
  ...over,
});

describe("canAdvance", () => {
  it("learn → speak_try1 needs examples", () => {
    expect(canAdvance(facts({ hasExamples: false }), "speak_try1").ok).toBe(false);
    expect(canAdvance(facts(), "speak_try1").ok).toBe(true);
  });

  it("speak_try1 → speak_try2 needs 4 counted try1 attempts", () => {
    const f = facts({ step: "speak_try1", counted: { try1: 3, try2: 0, read: 0 } });
    const r = canAdvance(f, "speak_try2");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe("Please finish all 4 recordings first.");
    expect(canAdvance({ ...f, counted: { try1: 4, try2: 0, read: 0 } }, "speak_try2").ok).toBe(true);
  });

  it("speak_try2 → write needs 4 counted try2 attempts", () => {
    const f = facts({ step: "speak_try2", counted: { try1: 4, try2: 3, read: 0 } });
    expect(canAdvance(f, "write").ok).toBe(false);
    expect(canAdvance({ ...f, counted: { try1: 4, try2: 4, read: 0 } }, "write").ok).toBe(true);
  });

  it("write → read_aloud needs 3 graded sentences", () => {
    expect(canAdvance(facts({ step: "write", gradedSentences: 2 }), "read_aloud").ok).toBe(false);
    expect(canAdvance(facts({ step: "write", gradedSentences: 3 }), "read_aloud").ok).toBe(true);
  });

  it("read_aloud → done needs 3 counted read attempts", () => {
    const f = facts({ step: "read_aloud", counted: { try1: 4, try2: 4, read: 2 } });
    expect(canAdvance(f, "done").ok).toBe(false);
    expect(canAdvance({ ...f, counted: { try1: 4, try2: 4, read: 3 } }, "done").ok).toBe(true);
  });

  it("rejects skipping steps or going backward", () => {
    expect(canAdvance(facts(), "speak_try2").ok).toBe(false);
    expect(canAdvance(facts({ step: "write", gradedSentences: 3 }), "speak_try1").ok).toBe(false);
    expect(canAdvance(facts({ step: "done" }), "done").ok).toBe(false);
  });
});

describe("isPhaseAllowed", () => {
  it("allows speak tries for idiom/example items only", () => {
    expect(isPhaseAllowed("idiom", "try1")).toBe(true);
    expect(isPhaseAllowed("example", "try2")).toBe(true);
    expect(isPhaseAllowed("corrected", "try1")).toBe(false);
  });

  it("allows read-aloud for corrected items only", () => {
    expect(isPhaseAllowed("corrected", "read")).toBe(true);
    expect(isPhaseAllowed("example", "read")).toBe(false);
  });
});
