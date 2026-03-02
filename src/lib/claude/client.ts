import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

let clientInstance: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!clientInstance) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("GENERATION_FAILED");
    }
    clientInstance = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    });
  }
  return clientInstance;
}

export function getModelId(): string {
  return env.ANTHROPIC_MODEL;
}

export function getMaxOutputTokens(): number {
  return parseInt(env.ANTHROPIC_MAX_OUTPUT_TOKENS, 10) || 16384;
}
