import { buildSearchQueries, searchOnyxMulti, assembleOnyxContext } from "@/lib/onyx";
import type { ArticleBrief } from "@/lib/onyx";
import type { PromptLayer } from "@/types/claude";

export async function buildLayerKbContext(brief: ArticleBrief): Promise<PromptLayer> {
  const queries = buildSearchQueries(brief);
  const contexts = await searchOnyxMulti(queries);
  const content = assembleOnyxContext(contexts);

  return {
    name: "Knowledge Base Context",
    content,
    tokenEstimate: Math.ceil(content.length / 4),
  };
}
