import type { CanonicalArticleDocument, ExternalLinkRef } from "@/types/article";

interface LinkValidationResult {
  document: CanonicalArticleDocument;
  removedLinks: { url: string; reason: string }[];
}

/**
 * Validates all external links in a CanonicalArticleDocument by making HTTP HEAD requests.
 * Dead links are removed from externalLinks[] and their <a> tags are stripped from
 * paragraph text (keeping the anchor text, removing the hyperlink).
 *
 * Runs all checks in parallel with a per-request timeout for speed.
 */
export async function validateExternalLinks(
  doc: CanonicalArticleDocument
): Promise<LinkValidationResult> {
  const removedLinks: { url: string; reason: string }[] = [];

  if (!doc.externalLinks || doc.externalLinks.length === 0) {
    return { document: doc, removedLinks };
  }

  // De-duplicate URLs for validation (avoid checking the same URL twice)
  const uniqueUrls = [...new Set(doc.externalLinks.map((l) => l.url))];

  // Validate all URLs in parallel
  const results = await Promise.allSettled(
    uniqueUrls.map((url) => checkUrl(url))
  );

  // Build a set of dead URLs
  const deadUrls = new Set<string>();
  for (let i = 0; i < uniqueUrls.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      deadUrls.add(uniqueUrls[i]);
      removedLinks.push({ url: uniqueUrls[i], reason: result.reason?.message || "Request failed" });
    } else if (!result.value.alive) {
      deadUrls.add(uniqueUrls[i]);
      removedLinks.push({ url: uniqueUrls[i], reason: result.value.reason });
    }
  }

  if (deadUrls.size === 0) {
    console.log(`[link-validator] All ${uniqueUrls.length} external links are valid`);
    return { document: doc, removedLinks };
  }

  console.warn(`[link-validator] Found ${deadUrls.size} dead link(s) out of ${uniqueUrls.length}`);
  for (const { url, reason } of removedLinks) {
    console.warn(`  [DEAD] ${url} — ${reason}`);
  }

  // Deep clone the document to avoid mutation
  const cleaned = JSON.parse(JSON.stringify(doc)) as CanonicalArticleDocument;

  // 1. Remove dead links from externalLinks[]
  cleaned.externalLinks = cleaned.externalLinks.filter(
    (link: ExternalLinkRef) => !deadUrls.has(link.url)
  );

  // 2. Strip <a> tags for dead URLs from paragraph text in all sections
  for (const section of cleaned.sections) {
    for (const node of section.content) {
      if ("text" in node && typeof node.text === "string") {
        node.text = stripDeadLinksFromHtml(node.text, deadUrls);
      }
    }
  }

  // 3. Also clean executiveSummary if it has inline links
  if (cleaned.executiveSummary) {
    cleaned.executiveSummary = stripDeadLinksFromHtml(cleaned.executiveSummary, deadUrls);
  }

  console.log(`[link-validator] Stripped ${deadUrls.size} dead link(s), kept ${cleaned.externalLinks.length} valid link(s)`);

  return { document: cleaned, removedLinks };
}

const REQUEST_TIMEOUT_MS = 5000;

interface CheckResult {
  alive: boolean;
  reason: string;
}

/**
 * Checks if a URL is reachable. Tries HEAD first, falls back to GET.
 * Returns alive:true if the response status is < 400.
 */
async function checkUrl(url: string): Promise<CheckResult> {
  // Quick sanity: must be a valid URL
  try {
    new URL(url);
  } catch {
    return { alive: false, reason: "Invalid URL format" };
  }

  // Try HEAD first (lightweight)
  try {
    const resp = await fetchWithTimeout(url, "HEAD");
    if (resp.status < 400) {
      return { alive: true, reason: "" };
    }
    // Some servers return 405 for HEAD — fall through to GET
    if (resp.status !== 405) {
      return { alive: false, reason: `HTTP ${resp.status}` };
    }
  } catch {
    // Network error on HEAD — try GET
  }

  // Fallback to GET
  try {
    const resp = await fetchWithTimeout(url, "GET");
    if (resp.status < 400) {
      return { alive: true, reason: "" };
    }
    return { alive: false, reason: `HTTP ${resp.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { alive: false, reason: msg.includes("abort") ? "Timeout" : msg };
  }
}

async function fetchWithTimeout(url: string, method: "HEAD" | "GET"): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method,
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Pretend to be a browser to avoid bot-blocking
        "User-Agent": "Mozilla/5.0 (compatible; BWC-LinkChecker/1.0)",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strips <a> tags whose href matches a dead URL, keeping the anchor text.
 * E.g. `<a href="https://dead.com">Some Text</a>` → `Some Text`
 */
function stripDeadLinksFromHtml(html: string, deadUrls: Set<string>): string {
  // Match <a> tags with href attribute
  return html.replace(
    /<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (fullMatch, href: string, innerText: string) => {
      if (deadUrls.has(href)) {
        return innerText; // Keep text, remove link
      }
      return fullMatch; // Keep the link
    }
  );
}
