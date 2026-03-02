import { prisma } from "@/lib/db";
import type { PromptLayer } from "@/types/claude";

export async function buildLayerBrief(articleId: number): Promise<PromptLayer> {
  const article = await prisma.contentMap.findUnique({
    where: { id: articleId },
  });

  if (!article) {
    throw new Error("NOT_FOUND");
  }

  // Get parent hub if this is a spoke
  let parentHub: { title: string; slug: string | null } | null = null;
  if (article.parentHubId) {
    parentHub = await prisma.contentMap.findUnique({
      where: { id: article.parentHubId },
      select: { title: true, slug: true },
    });
  }

  // Get sibling spokes if this is a hub or spoke
  const hubId = article.articleType === "hub" ? article.id : article.parentHubId;
  let siblingSpokes: { title: string; slug: string | null; publishedUrl: string | null }[] = [];
  if (hubId) {
    siblingSpokes = await prisma.contentMap.findMany({
      where: {
        parentHubId: hubId,
        id: { not: article.id },
      },
      select: { title: true, slug: true, publishedUrl: true },
    });
  }

  const lines: string[] = [
    `Article Title: ${article.title}`,
    `Article Type: ${article.articleType}`,
    `Slug: ${article.slug || "TBD"}`,
    `Hub Name: ${article.hubName}`,
    `Main Entity: ${article.mainEntity}`,
    `Supporting Entities: ${(article.supportingEntities as string[]).join(", ") || "None"}`,
    `Target Keywords: ${(article.targetKeywords as string[]).join(", ") || "None"}`,
  ];

  if (article.contentNotes) {
    lines.push(`Content Notes: ${article.contentNotes}`);
  }

  if (parentHub) {
    lines.push(`Parent Hub: "${parentHub.title}" (/${parentHub.slug || ""})`);
  }

  if (siblingSpokes.length > 0) {
    lines.push(`Sibling Spokes:`);
    for (const spoke of siblingSpokes) {
      const url = spoke.publishedUrl || `/${spoke.slug || ""}`;
      lines.push(`  - "${spoke.title}" (${url})`);
    }
  }

  const content = lines.join("\n");

  return {
    name: "Article Brief",
    content,
    tokenEstimate: Math.ceil(content.length / 4),
  };
}
