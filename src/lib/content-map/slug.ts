import type { PrismaClient } from "@prisma/client";

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "that", "which",
  "who", "whom", "this", "these", "those", "it", "its", "how", "what",
  "when", "where", "why", "not", "no", "nor", "so", "if", "then",
  "than", "too", "very", "just", "about", "above", "after", "again",
  "all", "also", "am", "as", "because", "before", "between", "both",
  "during", "each", "few", "further", "here", "into", "more", "most",
  "now", "only", "other", "our", "out", "own", "same", "some", "such",
  "up", "us", "we", "you", "your",
]);

/**
 * Generate a URL-safe slug from a title.
 * Lowercase, hyphenated, stop words removed, 3–6 words.
 */
export function generateSlug(title: string): string {
  const cleaned = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const allWords = cleaned.split(" ").filter((w) => w.length > 0);
  const meaningful = allWords.filter((w) => !STOP_WORDS.has(w));

  // Use meaningful words if we have at least 3, otherwise fall back to all words
  const words = meaningful.length >= 3 ? meaningful : allWords;

  return words.slice(0, 6).join("-");
}

/**
 * Ensure a slug is unique in the content_map table.
 * Appends -2, -3, etc. on collision.
 */
export async function ensureUniqueSlug(
  baseSlug: string,
  db: PrismaClient
): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await db.contentMap.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }
}
