import { buildSearchQueries } from "@/lib/onyx";
import { assembleOnyxContext } from "@/lib/onyx";
import { getRagProvider } from "@/lib/rag";
import type { ArticleBrief } from "@/lib/onyx";
import type { PromptLayer } from "@/types/claude";
import type { OnyxSearchResult } from "@/types/onyx";

export async function buildLayerKbContext(
  brief: ArticleBrief
): Promise<{ layer: PromptLayer; onyxSources: OnyxSearchResult[] }> {
  const queries = buildSearchQueries(brief);
  const provider = getRagProvider();
  const contexts = await provider.searchMulti(queries);
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
