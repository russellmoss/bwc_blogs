import type { CanonicalArticleDocument } from "@/types/article";
import type { UndoEntry } from "@/types/ui";
import type { HtmlOverride } from "@/types/renderer";

const MAX_UNDO_DEPTH = 50;

/** Create a snapshot of the current editor state */
export function createUndoEntry(
  document: CanonicalArticleDocument,
  html: string,
  htmlOverrides: HtmlOverride[],
  label: string
): UndoEntry {
  return {
    document: structuredClone(document),
    html,
    htmlOverrides: structuredClone(htmlOverrides),
    timestamp: new Date().toISOString(),
    label,
  };
}

/** Push an entry onto the undo stack, enforcing depth limit */
export function pushToStack(stack: UndoEntry[], entry: UndoEntry): UndoEntry[] {
  const newStack = [...stack, entry];
  if (newStack.length > MAX_UNDO_DEPTH) {
    return newStack.slice(newStack.length - MAX_UNDO_DEPTH);
  }
  return newStack;
}

/** Pop the top entry from a stack, returning [poppedEntry, remainingStack] */
export function popFromStack(stack: UndoEntry[]): [UndoEntry | null, UndoEntry[]] {
  if (stack.length === 0) return [null, stack];
  const newStack = stack.slice(0, -1);
  const entry = stack[stack.length - 1];
  return [entry, newStack];
}

/**
 * Resolve a dot-notation data-cad-path to set a value on a canonical document.
 * Returns a deep-cloned document with the value set at the specified path.
 *
 * Supports: "title", "sections[0].heading", "sections[0].content[1].text",
 * "sections[0].content[1].facts[2].label", "faq[0].question", "author.name", etc.
 */
export function setByPath(
  doc: CanonicalArticleDocument,
  cadPath: string,
  value: string
): CanonicalArticleDocument {
  const clone = structuredClone(doc);

  // Parse path into segments: "sections[0].content[1].text" -> ["sections", 0, "content", 1, "text"]
  const segments: (string | number)[] = [];
  const regex = /([a-zA-Z_]+)|\[(\d+)\]/g;
  let match;
  while ((match = regex.exec(cadPath)) !== null) {
    if (match[1] !== undefined) {
      segments.push(match[1]);
    } else if (match[2] !== undefined) {
      segments.push(parseInt(match[2], 10));
    }
  }

  if (segments.length === 0) return clone;

  // Walk the object to the parent of the target field
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = clone;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (current[seg] === undefined) return clone; // path doesn't exist, return unchanged
    current = current[seg];
  }

  // Set the value
  const lastSeg = segments[segments.length - 1];
  current[lastSeg] = value;

  return clone;
}
