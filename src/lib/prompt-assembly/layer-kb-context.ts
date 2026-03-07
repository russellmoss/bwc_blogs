import { buildSearchQueries, searchOnyxMulti, assembleOnyxContext } from "@/lib/onyx";
import type { ArticleBrief } from "@/lib/onyx";
import type { PromptLayer } from "@/types/claude";
import type { OnyxSearchResult } from "@/types/onyx";

export async function buildLayerKbContext(
  brief: ArticleBrief
): Promise<{ layer: PromptLayer; onyxSources: OnyxSearchResult[] }> {
  const queries = buildSearchQueries(brief);
  const contexts = await searchOnyxMulti(queries);
  const { text, sources } = assembleOnyxContext(contexts);

  return {
    layer: {
      name: "Knowledge Base Context",
      content: text,
      tokenEstimate: Math.ceil(text.length / 4),
    },
    onyxSources: sources,
  };
}
