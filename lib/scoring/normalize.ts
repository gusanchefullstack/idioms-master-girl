// Normalization applied to BOTH the target and the transcript before alignment (research R3).

const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/g, "cannot"],
  [/\bwon't\b/g, "will not"],
  [/\bshan't\b/g, "shall not"],
  [/\bain't\b/g, "is not"],
  [/\blet's\b/g, "let us"],
  [/\bi'm\b/g, "i am"],
  [/\b(it|that|there|here|what|who|where|he|she)'s\b/g, "$1 is"],
  [/n't\b/g, " not"],
  [/'re\b/g, " are"],
  [/'ll\b/g, " will"],
  [/'ve\b/g, " have"],
  [/'d\b/g, " would"],
];

const NUMBERS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];

export function normalizeText(text: string): string {
  let t = text.normalize("NFKC").toLowerCase();
  t = t.replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"');
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep);
  t = t.replace(/[-–—]/g, " ");
  t = t.replace(/\b(\d{1,2})\b/g, (m, d: string) => (Number(d) <= 20 ? NUMBERS[Number(d)] : m));
  // Possessive 's stays part of the word; every other punctuation mark goes.
  t = t.replace(/'(?!s\b)/g, "").replace(/[^\p{L}\p{N}'\s]/gu, " ");
  return t.replace(/\s+/g, " ").trim();
}

export function normalizeWords(text: string): string[] {
  const t = normalizeText(text);
  return t ? t.split(" ") : [];
}
