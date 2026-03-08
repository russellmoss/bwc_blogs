import { env } from "@/lib/env";
import { OnyxProvider } from "./onyx-provider";
import { CustomProvider } from "./custom-provider";
import { BothProvider } from "./both-provider";
import type { RagProvider, RagProviderType } from "@/types/rag";

let cached: RagProvider | null = null;
let cachedType: string | null = null;

/**
 * Factory: returns the configured RAG provider.
 * Reads RAG_PROVIDER env var: "onyx" | "custom" | "both"
 */
export function getRagProvider(): RagProvider {
  const providerType = (env.RAG_PROVIDER || "custom") as RagProviderType;

  // Cache by type (allows hot-swapping in tests by changing env)
  if (cached && cachedType === providerType) return cached;

  switch (providerType) {
    case "custom":
      cached = new CustomProvider();
      break;
    case "both":
      cached = new BothProvider();
      break;
    case "onyx":
    default:
      cached = new OnyxProvider();
      break;
  }

  cachedType = providerType;
  return cached;
}
