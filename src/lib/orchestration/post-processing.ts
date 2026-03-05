import { repairCanonicalDocument, validateCanonicalDocument } from "@/lib/article-schema";
import { renderArticle, TEMPLATE_VERSION } from "@/lib/renderer";
import { validateExternalLinks } from "./link-validator";
import type { CanonicalArticleDocument } from "@/types/article";
import type { ValidationResult } from "@/types/api";
import type { RendererOutput } from "@/types/renderer";

export interface PostProcessingResult {
  document: CanonicalArticleDocument;
  html: string;
  validationResult: ValidationResult;
  wordCount: number;
}

export async function runPostProcessing(rawDocument: CanonicalArticleDocument): Promise<PostProcessingResult> {
  // Step 1: Repair common LLM output issues
  const { repaired, changes } = repairCanonicalDocument(rawDocument);
  if (changes.length > 0) {
    console.log(`[post-processing] Repaired ${changes.length} issues:`, changes);
  }

  // Step 2: Validate external links (HTTP HEAD checks, strip dead links)
  let linkChecked = repaired;
  try {
    const linkResult = await validateExternalLinks(repaired);
    linkChecked = linkResult.document;
    if (linkResult.removedLinks.length > 0) {
      console.warn(`[post-processing] Removed ${linkResult.removedLinks.length} dead external link(s)`);
    }
  } catch (err) {
    console.warn("[post-processing] Link validation failed, skipping:", err);
  }

  // Step 3: Validate against schema + SOP rules
  const validationResult = validateCanonicalDocument(linkChecked);
  if (!validationResult.valid) {
    console.warn(
      `[post-processing] Validation found ${validationResult.errors.length} errors, ${validationResult.warnings.length} warnings`
    );
    for (const err of validationResult.errors) {
      console.warn(`  [ERROR] ${err.path}: ${err.message}`);
    }
    for (const warn of validationResult.warnings) {
      console.warn(`  [WARN] ${warn}`);
    }
  }

  // Step 4: Render to HTML (renderer internally calls repair again — safe)
  let rendererOutput: RendererOutput;
  try {
    rendererOutput = renderArticle({
      document: linkChecked,
      htmlOverrides: null,
      templateVersion: TEMPLATE_VERSION,
    });
  } catch (error) {
    // If rendering fails, return empty HTML with the validation result
    console.error("[post-processing] Render failed:", error);
    return {
      document: linkChecked,
      html: "",
      validationResult: {
        ...validationResult,
        errors: [
          ...validationResult.errors,
          { path: "renderer", message: "HTML rendering failed" },
        ],
        valid: false,
      },
      wordCount: 0,
    };
  }

  return {
    document: linkChecked,
    html: rendererOutput.html,
    validationResult,
    wordCount: rendererOutput.wordCount,
  };
}
