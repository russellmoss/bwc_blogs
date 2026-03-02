import fs from "fs";
import path from "path";
import type { PromptLayer } from "@/types/claude";

let cachedContent: string | null = null;

export function buildLayerSop(): PromptLayer {
  if (!cachedContent) {
    const filePath = path.resolve(
      process.cwd(),
      "docs/BWC Master Content Engine SOP.md"
    );
    cachedContent = fs.readFileSync(filePath, "utf-8");
  }
  return {
    name: "Master SOP",
    content: cachedContent,
    tokenEstimate: Math.ceil(cachedContent.length / 4),
  };
}
