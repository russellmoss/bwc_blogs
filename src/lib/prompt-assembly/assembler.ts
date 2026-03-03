import type { PromptLayer } from "@/types/claude";
import type { PhotoManifest } from "@/types/photo";
import type { ArticleBrief } from "@/lib/onyx";
import { buildLayerSop } from "./layer-sop";
import { buildLayerStyleGuide } from "./layer-style-guide";
import { buildLayerTemplateRef } from "./layer-template-ref";
import { buildLayerBrief } from "./layer-brief";
import { buildLayerKbContext } from "./layer-kb-context";
import { buildLayerLinkGraph } from "./layer-link-graph";
import { buildLayerPhotoManifest } from "./layer-photo-manifest";
import { buildLayerWritingVoice } from "./layer-writing-voice";

export interface AssembledPrompt {
  systemPrompt: string;
  layers: PromptLayer[];
  totalTokenEstimate: number;
}

const OUTPUT_FORMAT_INSTRUCTION = `
=== OUTPUT FORMAT ===
You MUST respond with a single valid JSON object conforming to the CanonicalArticleDocument schema.

CRITICAL RULES:
- Output ONLY the JSON object — no markdown fences, no commentary, no explanation
- Do NOT output HTML — output structured JSON only. The Article Renderer handles HTML.
- Every section must have a unique "id" field: "section-1", "section-2", etc.
- Every content node must have a unique "id" field: "node-1", "node-2", etc.
- All internal links must target URLs from the Link Graph above
- All external links must include trustTier and sourceName
- executiveSummary: 25-40 words
- metaTitle: 50-60 characters
- metaDescription: 150-160 characters

If you need to search the web for external source URLs, use the web_search tool.
After searching, embed the found URLs directly in the externalLinks array.
`;

export async function assembleSystemPrompt(
  articleId: number,
  photoManifest: PhotoManifest | null,
  styleId: number | null = null
): Promise<AssembledPrompt> {
  // Static layers (cached)
  const layerSop = buildLayerSop();
  const layerStyleGuide = buildLayerStyleGuide();
  const layerTemplateRef = buildLayerTemplateRef();

  // Dynamic layers — brief first (needed for KB context)
  const layerBrief = await buildLayerBrief(articleId);

  // Extract brief data for Onyx queries
  const briefContent = layerBrief.content;
  const mainEntityMatch = briefContent.match(/Main Entity: (.+)/);
  const supportingMatch = briefContent.match(/Supporting Entities: (.+)/);
  const keywordsMatch = briefContent.match(/Target Keywords: (.+)/);
  const titleMatch = briefContent.match(/Article Title: (.+)/);

  const brief: ArticleBrief = {
    title: titleMatch?.[1] || "",
    mainEntity: mainEntityMatch?.[1] || "",
    supportingEntities: supportingMatch?.[1]?.split(", ").filter(Boolean) || [],
    targetKeywords: keywordsMatch?.[1]?.split(", ").filter(Boolean) || [],
  };

  // Parallel: KB context + link graph
  const [layerKbContext, layerLinkGraph] = await Promise.all([
    buildLayerKbContext(brief),
    buildLayerLinkGraph(articleId),
  ]);

  const layerPhotoManifest = buildLayerPhotoManifest(photoManifest);

  // Session-scoped: writing voice (Layer 8)
  const layerWritingVoice = await buildLayerWritingVoice(styleId);

  const layers: PromptLayer[] = [
    layerSop,
    layerStyleGuide,
    layerTemplateRef,
    ...(layerWritingVoice ? [layerWritingVoice] : []),
    layerBrief,
    layerKbContext,
    layerLinkGraph,
    layerPhotoManifest,
  ];

  const sections = layers.map(
    (layer) => `=== LAYER: ${layer.name.toUpperCase()} ===\n${layer.content}`
  );
  sections.push(OUTPUT_FORMAT_INSTRUCTION);

  const systemPrompt = sections.join("\n\n");
  const totalTokenEstimate = layers.reduce((sum, l) => sum + l.tokenEstimate, 0);

  return { systemPrompt, layers, totalTokenEstimate };
}
