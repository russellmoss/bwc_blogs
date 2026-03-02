import type { CanonicalArticleDocument } from "@/types/article";
import { CanonicalArticleDocumentSchema } from "@/lib/article-schema/schema";

/** Fields that must NEVER be overwritten by a patch */
const IDENTITY_FIELDS = new Set([
  "version",
  "articleId",
  "slug",
  "articleType",
  "hubId",
]);

/** Fields that are objects and should be shallow-merged */
const OBJECT_MERGE_FIELDS = new Set(["author", "schema"]);

/** Fields that are arrays and should be fully replaced (not concatenated) */
const ARRAY_REPLACE_FIELDS = new Set([
  "sections",
  "internalLinks",
  "externalLinks",
  "faq",
  "captureComponents",
  "dataNosnippetSections",
]);

export interface MergeResult {
  document: CanonicalArticleDocument;
  merged: boolean;
  error: string | null;
}

/**
 * Merge a partial JSON response from Claude into a full CanonicalArticleDocument.
 *
 * If the partial appears to be a full document (has version + articleId),
 * validates and returns it directly. Otherwise performs a field-by-field merge.
 */
export function mergePartialDocument(
  base: CanonicalArticleDocument,
  partial: Record<string, unknown>
): MergeResult {
  // Safety: if partial is empty or not an object, return base unchanged
  if (!partial || typeof partial !== "object" || Object.keys(partial).length === 0) {
    return { document: base, merged: false, error: "Empty or invalid partial response" };
  }

  // Check if Claude returned a full document instead of a patch
  if ("version" in partial && "articleId" in partial && "sections" in partial) {
    const parsed = CanonicalArticleDocumentSchema.safeParse(partial);
    if (parsed.success) {
      return {
        document: parsed.data as CanonicalArticleDocument,
        merged: true,
        error: null,
      };
    }
    // Full doc failed validation — fall through to patch merge
  }

  // Perform field-by-field merge
  const merged = structuredClone(base);

  for (const [key, value] of Object.entries(partial)) {
    // Skip identity fields
    if (IDENTITY_FIELDS.has(key)) continue;

    // Skip if field doesn't exist on the document type
    if (!(key in merged)) continue;

    if (OBJECT_MERGE_FIELDS.has(key) && value && typeof value === "object" && !Array.isArray(value)) {
      // Shallow merge for author, schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (merged as any)[key] = { ...(merged as any)[key], ...value };
    } else if (ARRAY_REPLACE_FIELDS.has(key) && Array.isArray(value)) {
      // Full array replacement
      if (key === "sections") {
        // Validate that each section has an id
        const validSections = value.every(
          (s: unknown) => typeof s === "object" && s !== null && "id" in s
        );
        if (!validSections) continue; // Skip invalid sections array
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (merged as any)[key] = value;
    } else {
      // Scalar replacement (title, metaTitle, executiveSummary, etc.)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (merged as any)[key] = value;
    }
  }

  // Validate the merged document
  const validated = CanonicalArticleDocumentSchema.safeParse(merged);
  if (!validated.success) {
    return {
      document: base,
      merged: false,
      error: `Merged document failed validation: ${validated.error.issues.map((i) => i.message).join("; ")}`,
    };
  }

  return {
    document: validated.data as CanonicalArticleDocument,
    merged: true,
    error: null,
  };
}

/**
 * Parse Claude's text response into a JSON object.
 * Handles common response artifacts: markdown fences, trailing text, etc.
 */
export function parsePartialJson(text: string): Record<string, unknown> | null {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Try direct parse first
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    // Try to find the first { ... } block
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        const extracted = cleaned.slice(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(extracted);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Fall through
      }
    }
    return null;
  }
}
