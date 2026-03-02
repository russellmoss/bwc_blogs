import { CanonicalArticleDocument } from "./article";

export interface HtmlOverride {
  path: string; // CSS selector or data-cad-path
  html: string; // Replacement HTML fragment
  reason: string; // Why the override was applied
}

export interface RendererInput {
  document: CanonicalArticleDocument;
  htmlOverrides: HtmlOverride[] | null;
  templateVersion: string;
}

export interface RendererOutput {
  html: string;
  metaTitle: string;
  metaDescription: string;
  schemaJson: string;
  wordCount: number;
}
