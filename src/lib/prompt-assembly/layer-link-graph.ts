import { prisma } from "@/lib/db";
import type { PromptLayer } from "@/types/claude";

export async function buildLayerLinkGraph(articleId: number): Promise<PromptLayer> {
  // 1. Core page links (from internal_links table)
  const coreLinks = await prisma.internalLink.findMany({
    where: { linkType: "to-core-page", isActive: true },
    select: { targetCorePage: true, anchorText: true },
  });

  // 2. Published article URLs (from content_map where published)
  const publishedArticles = await prisma.contentMap.findMany({
    where: {
      status: "published",
      publishedUrl: { not: null },
      id: { not: articleId },
    },
    select: { title: true, slug: true, publishedUrl: true, articleType: true, hubName: true },
  });

  // 3. Hub-spoke relationships for the current article's cluster
  const currentArticle = await prisma.contentMap.findUnique({
    where: { id: articleId },
    select: { articleType: true, parentHubId: true, id: true },
  });

  let clusterArticles: { title: string; slug: string | null; publishedUrl: string | null; articleType: string }[] = [];
  if (currentArticle) {
    const hubId = currentArticle.articleType === "hub" ? currentArticle.id : currentArticle.parentHubId;
    if (hubId) {
      clusterArticles = await prisma.contentMap.findMany({
        where: { OR: [{ id: hubId }, { parentHubId: hubId }], id: { not: articleId } },
        select: { title: true, slug: true, publishedUrl: true, articleType: true },
      });
    }
  }

  const lines: string[] = [
    "INTERNAL LINK INSTRUCTIONS:",
    "- Link to the URLs listed below using natural anchor text",
    "- Do NOT link to articles with status 'planned' — only published URLs",
    "- Core pages should be linked where contextually relevant",
    "- Hub-spoke cluster links are high priority for SEO",
    "",
    "CORE BWC PAGES:",
  ];

  for (const link of coreLinks) {
    const page = link.targetCorePage || "unknown";
    const anchor = link.anchorText || page;
    lines.push(`  - ${anchor}: https://www.bhutanwine.com/${page}`);
  }

  if (publishedArticles.length > 0) {
    lines.push("", "PUBLISHED BLOG ARTICLES:");
    for (const article of publishedArticles) {
      lines.push(`  - "${article.title}" [${article.articleType}]: ${article.publishedUrl}`);
    }
  } else {
    lines.push("", "PUBLISHED BLOG ARTICLES: None yet. Use core page links and external sources.");
  }

  if (clusterArticles.length > 0) {
    lines.push("", "HUB-SPOKE CLUSTER (prioritize these for internal linking):");
    for (const article of clusterArticles) {
      const url = article.publishedUrl || `[not yet published: ${article.slug}]`;
      lines.push(`  - "${article.title}" [${article.articleType}]: ${url}`);
    }
  }

  const content = lines.join("\n");

  return {
    name: "Internal Link Graph",
    content,
    tokenEstimate: Math.ceil(content.length / 4),
  };
}
