import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./config";

export interface Idiom {
  id: string;
  phrase: string;
  spoken: string;
  variants: string[];
  level: "A2" | "B1";
  difficulty: 1 | 2 | 3;
  meaning: string;
  whenToUse: string;
  register: string;
  region: string;
  literalNote: string;
  fallbackExamples: string[];
}

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const normalizeQuotes = (s: string) => s.replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"');

const regexCache = new Map<string, RegExp>();
function variantRegex(src: string): RegExp {
  let re = regexCache.get(src);
  if (!re) {
    re = new RegExp(src, "i");
    regexCache.set(src, re);
  }
  return re;
}

/** Deterministic idiom check (research R9): any variant regex matches. */
export function matchesIdiom(idiom: Pick<Idiom, "variants">, text: string): boolean {
  const t = normalizeQuotes(text);
  return idiom.variants.some((v) => variantRegex(v).test(t));
}

/** Returns a list of problems; empty means valid (contracts/content-config.md). */
export function validateIdioms(idioms: Idiom[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const i of idioms) {
    const at = `idiom "${i.id}"`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(i.id)) errors.push(`${at}: id must be kebab-case`);
    if (seen.has(i.id)) errors.push(`${at}: duplicate id`);
    seen.add(i.id);
    if (!["A2", "B1"].includes(i.level)) errors.push(`${at}: level must be A2 or B1`);
    if (![1, 2, 3].includes(i.difficulty)) errors.push(`${at}: difficulty must be 1, 2 or 3`);
    if (!Array.isArray(i.variants) || i.variants.length === 0) errors.push(`${at}: needs variants`);
    let compiled = true;
    for (const v of i.variants ?? []) {
      try {
        variantRegex(v);
      } catch {
        compiled = false;
        errors.push(`${at}: variant does not compile: ${v}`);
      }
    }
    for (const f of ["phrase", "spoken", "meaning", "whenToUse", "register", "region", "literalNote"] as const) {
      if (typeof i[f] !== "string" || !i[f].trim()) errors.push(`${at}: missing ${f}`);
    }
    if (wordCount(i.meaning ?? "") > 20) errors.push(`${at}: meaning over 20 words`);
    if (wordCount(i.whenToUse ?? "") > 25) errors.push(`${at}: whenToUse over 25 words`);
    if (!Array.isArray(i.fallbackExamples) || i.fallbackExamples.length !== 3) {
      errors.push(`${at}: needs exactly 3 fallbackExamples`);
    }
    if (compiled) {
      if (!matchesIdiom(i, i.spoken ?? "")) errors.push(`${at}: spoken does not match a variant`);
      for (const ex of i.fallbackExamples ?? []) {
        if (!matchesIdiom(i, ex)) errors.push(`${at}: example does not match a variant: "${ex}"`);
        if (wordCount(ex) > 15) errors.push(`${at}: example over 15 words: "${ex}"`);
      }
    }
  }
  return errors;
}

let cache: { list: Idiom[]; byId: Map<string, Idiom> } | null = null;

function load() {
  if (!cache) {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "idioms.json"), "utf8")) as {
      idioms: Idiom[];
    };
    const errors = validateIdioms(raw.idioms);
    if (errors.length) throw new Error(`content/idioms.json is invalid:\n- ${errors.join("\n- ")}`);
    cache = { list: raw.idioms, byId: new Map(raw.idioms.map((i) => [i.id, i])) };
  }
  return cache;
}

export const listIdioms = (): Idiom[] => load().list;

export function getIdiom(id: string): Idiom {
  const idiom = load().byId.get(id);
  if (!idiom) throw new Error(`Unknown idiom id: ${id}`);
  return idiom;
}
