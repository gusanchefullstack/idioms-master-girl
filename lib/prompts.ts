import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./config";

const PROMPTS_DIR = path.join(ROOT, "prompts");

/** Render prompts/<name>.md, replacing {{key}}. Missing or leftover placeholders are errors. */
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  const out = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    if (!(key in vars) || vars[key] === undefined || vars[key] === null) {
      throw new Error(`Prompt placeholder {{${key}}} has no value`);
    }
    return String(vars[key]);
  });
  return out;
}

export function renderPrompt(name: string, vars: Record<string, string | number>): string {
  return renderTemplate(fs.readFileSync(path.join(PROMPTS_DIR, `${name}.md`), "utf8"), vars).trim();
}

export function loadPraiseLines(): string[] {
  return fs
    .readFileSync(path.join(PROMPTS_DIR, "praise.md"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
