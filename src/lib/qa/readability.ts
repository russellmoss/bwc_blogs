/**
 * Pure-function Flesch-Kincaid readability calculator.
 * No dependencies — all computation is local.
 */

/** Count syllables in a single word using vowel-group heuristic (~90% accuracy) */
export function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;

  const vowelGroups = word.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;

  // Silent 'e' at end (but not "le" endings like "bottle", "table")
  if (word.endsWith("e") && !word.endsWith("le")) count--;
  // Silent 'es' / 'ed' suffixes
  if (word.endsWith("es") || word.endsWith("ed")) count--;

  return Math.max(count, 1);
}

/** Count sentences by splitting on terminal punctuation */
export function countSentences(text: string): number {
  const sentences = text
    .split(/[.!?]+(?:\s|$)/)
    .filter((s) => s.trim().length > 0);
  return Math.max(sentences.length, 1);
}

/**
 * Calculate Flesch-Kincaid Grade Level.
 * Formula: 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
 *
 * Target for BWC: Grade 10–14 (luxury wine audience).
 * Below 10 = too simple. Above 14 = too academic.
 */
export function fleschKincaidGrade(text: string): number {
  const stripped = text.replace(/<[^>]*>/g, "").trim();
  const words = stripped.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return 0;

  const totalWords = words.length;
  const totalSentences = countSentences(stripped);
  const totalSyllables = words.reduce(
    (sum, w) => sum + countSyllables(w),
    0
  );

  const grade =
    0.39 * (totalWords / totalSentences) +
    11.8 * (totalSyllables / totalWords) -
    15.59;

  return Math.round(grade * 10) / 10; // One decimal place
}
