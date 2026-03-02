export interface ArticleBrief {
  title: string;
  mainEntity: string;
  supportingEntities: string[];
  targetKeywords: string[];
}

const MAX_QUERIES = 5;

export function buildSearchQueries(brief: ArticleBrief): string[] {
  const { title, mainEntity, supportingEntities, targetKeywords } = brief;

  // Fallback: if mainEntity is empty, return just the title
  if (!mainEntity.trim()) {
    return [title];
  }

  const queries: string[] = [];

  // 1. Primary entity query
  queries.push(`What are the key facts about ${mainEntity}?`);

  // 2. Keyword-entity cross query
  if (targetKeywords.length > 0) {
    queries.push(`${targetKeywords[0]} ${mainEntity}`);
  }

  // 3. Supporting entity queries (up to 2)
  const supportingSlice = supportingEntities.slice(0, 2);
  for (const entity of supportingSlice) {
    queries.push(
      `What is the relationship between ${mainEntity} and ${entity}?`
    );
  }

  // 4. Brand context query
  queries.push(`Bhutan Wine Company ${mainEntity}`);

  // Deduplicate (case-insensitive)
  const seen = new Set<string>();
  const deduped = queries.filter((q) => {
    const key = q.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Cap at MAX_QUERIES
  return deduped.slice(0, MAX_QUERIES);
}
