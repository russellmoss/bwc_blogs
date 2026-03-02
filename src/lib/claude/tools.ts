import type Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

type ToolUnion = Anthropic.Messages.ToolUnion;

export function getGenerationTools(): ToolUnion[] {
  if (env.ENABLE_WEB_SEARCH !== "true") return [];
  return [
    {
      type: "web_search_20250305",
      name: "web_search",
    },
  ];
}
