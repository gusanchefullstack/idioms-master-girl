import { getSettings } from "../config";
import { renderPrompt } from "../prompts";
import type { Learner } from "../auth";

const DIFFICULTY_LABELS = ["", "basic", "medium", "advanced"];

/** Prompt label derived from the profile range, e.g. 1–2 → "basic to medium" (research R14). */
export function difficultyLabel(min: number, max: number): string {
  return min === max ? DIFFICULTY_LABELS[min] : `${DIFFICULTY_LABELS[min]} to ${DIFFICULTY_LABELS[max]}`;
}

export function systemPrompt(learner: Pick<Learner, "level" | "difficulty_min" | "difficulty_max">): string {
  return renderPrompt("system", {
    personality: getSettings().tutor.personality,
    level: learner.level,
    difficultyLabel: difficultyLabel(learner.difficulty_min, learner.difficulty_max),
  });
}
