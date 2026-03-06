import { prisma } from "@/lib/db";

export interface MatchedPage {
  page: string;
  contentMapId: number;
}

export async function matchPagesToContentMap(pages: string[]): Promise<MatchedPage[]> {
  const entries = await prisma.contentMap.findMany({
    where: {
      OR: [
        { publishedUrl: { not: null } },
        { slug: { not: null } },
      ],
    },
    select: { id: true, publishedUrl: true, slug: true },
  });

  const matched: MatchedPage[] = [];

  for (const page of pages) {
    const exactMatch = entries.find(
      (e) => e.publishedUrl && e.publishedUrl === page
    );
    if (exactMatch) {
      matched.push({ page, contentMapId: exactMatch.id });
      continue;
    }

    const slugMatch = entries.find(
      (e) => e.slug && (page.endsWith("/" + e.slug) || page.endsWith("/" + e.slug + "/"))
    );
    if (slugMatch) {
      matched.push({ page, contentMapId: slugMatch.id });
    }
  }

  return matched;
}
