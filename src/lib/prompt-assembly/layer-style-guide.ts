import fs from "fs";
import path from "path";
import type { PromptLayer } from "@/types/claude";

let cachedContent: string | null = null;

export function buildLayerStyleGuide(): PromptLayer {
  if (!cachedContent) {
    const filePath = path.resolve(
      process.cwd(),
      "docs/Bhutan Wine Company \u2014 Brand Style Guide for HTML Blog Posts (3).md"
    );
    cachedContent = fs.readFileSync(filePath, "utf-8");
  }
  return {
    name: "Brand Style Guide",
    content: cachedContent,
    tokenEstimate: Math.ceil(cachedContent.length / 4),
  };
}
