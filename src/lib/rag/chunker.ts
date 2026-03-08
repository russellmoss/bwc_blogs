/**
 * Recursive markdown text splitter.
 * Splits on heading boundaries first, then paragraphs, then sentences.
 * Produces overlapping chunks for better retrieval.
 */

const TARGET_CHUNK_TOKENS = 500;
const OVERLAP_TOKENS = 100;
// Rough estimate: 1 token ≈ 4 characters
const CHARS_PER_TOKEN = 4;
const TARGET_CHUNK_CHARS = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

export interface TextChunk {
  content: string;
  tokenCount: number;
  headingContext: string | null;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Extract the current heading context from a markdown chunk.
 */
function extractHeadingContext(text: string): string | null {
  const lines = text.split("\n");
  for (const line of lines) {
    const match = line.match(/^#{1,3}\s+(.+)/);
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * Split text by a set of separators, trying the most meaningful first.
 */
function splitRecursive(text: string, separators: string[]): string[] {
  if (text.length <= TARGET_CHUNK_CHARS) {
    return [text];
  }

  for (const separator of separators) {
    const parts = text.split(separator).filter((p) => p.trim().length > 0);
    if (parts.length > 1) {
      // Re-attach heading markers that split() consumed (e.g. "\n## " → "## ")
      const headingPrefix = separator.replace(/^\n/, "");
      const isHeadingSeparator = headingPrefix.startsWith("#");
      return parts.map((p, idx) => {
        const trimmed = p.trim();
        // First part keeps its original form; subsequent parts get the prefix restored
        if (isHeadingSeparator && idx > 0) return headingPrefix + trimmed;
        return trimmed;
      });
    }
  }

  // Fallback: hard split at target size
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += TARGET_CHUNK_CHARS) {
    chunks.push(text.slice(i, i + TARGET_CHUNK_CHARS));
  }
  return chunks;
}

/**
 * Split markdown into overlapping chunks suitable for embedding.
 */
export function chunkMarkdown(markdown: string): TextChunk[] {
  if (!markdown.trim()) return [];

  const separators = [
    "\n## ",   // H2 boundaries (strongest)
    "\n### ",  // H3 boundaries
    "\n\n",    // Paragraph boundaries
    "\n",      // Line boundaries
    ". ",      // Sentence boundaries
  ];

  // First pass: split into raw segments
  const rawSegments = splitRecursive(markdown, separators);

  // Second pass: merge small segments and split large ones
  const mergedSegments: string[] = [];
  let buffer = "";

  for (const segment of rawSegments) {
    if (buffer.length + segment.length <= TARGET_CHUNK_CHARS) {
      buffer = buffer ? buffer + "\n\n" + segment : segment;
    } else {
      if (buffer) mergedSegments.push(buffer);
      if (segment.length > TARGET_CHUNK_CHARS) {
        // Recursively split oversized segments
        const subSeparators = separators.slice(separators.indexOf("\n\n"));
        const subSegments = splitRecursive(segment, subSeparators);
        mergedSegments.push(...subSegments);
        buffer = ""; // reset — oversized segment was pushed directly
      } else {
        buffer = segment;
      }
    }
  }
  if (buffer) mergedSegments.push(buffer);

  // Third pass: create overlapping chunks
  const chunks: TextChunk[] = [];
  let lastHeading: string | null = null;

  for (let i = 0; i < mergedSegments.length; i++) {
    let content = mergedSegments[i];

    // Add overlap from previous segment
    if (i > 0 && OVERLAP_CHARS > 0) {
      const prevText = mergedSegments[i - 1];
      const overlapText = prevText.slice(-OVERLAP_CHARS);
      content = overlapText + "\n\n" + content;
    }

    const heading = extractHeadingContext(content) ?? lastHeading;
    if (extractHeadingContext(mergedSegments[i])) {
      lastHeading = extractHeadingContext(mergedSegments[i]);
    }

    chunks.push({
      content: content.trim(),
      tokenCount: estimateTokens(content),
      headingContext: heading,
    });
  }

  return chunks;
}
