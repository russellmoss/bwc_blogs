import type { CanonicalArticleDocument } from "@/types/article";
import type { QAResult } from "@/types/qa";
import type { DomAdapter } from "../engine";
import { CHECK_REGISTRY, createResult } from "../engine";

const PROHIBITED_ANCHORS = ["click here", "read more", "learn more", "link", "here"];
const COMPETITOR_DOMAINS = [
  "wine.com", "vivino.com", "totalwine.com", "drizly.com",
  "winc.com", "nakedwines.com", "cellartracker.com",
];

export function runLinkChecks(
  doc: CanonicalArticleDocument,
  dom: DomAdapter
): QAResult[] {
  const results: QAResult[] = [];

  // F15: Prohibited anchor text (FAIL level)
  const prohibitedFound: string[] = [];
  for (const link of doc.internalLinks) {
    if (PROHIBITED_ANCHORS.includes(link.anchorText.toLowerCase().trim())) {
      prohibitedFound.push(link.anchorText);
    }
  }
  for (const link of doc.externalLinks) {
    if (PROHIBITED_ANCHORS.includes(link.anchorText.toLowerCase().trim())) {
      prohibitedFound.push(link.anchorText);
    }
  }
  results.push(
    createResult(
      CHECK_REGISTRY.F15,
      prohibitedFound.length === 0,
      prohibitedFound.length === 0
        ? "No prohibited anchor text found"
        : `Found prohibited anchor text: "${prohibitedFound[0]}"`,
      null,
      prohibitedFound.length > 0
        ? `Replace the generic anchor text "${prohibitedFound[0]}" with a descriptive 3-8 word phrase.`
        : null
    )
  );

  // W06: Spoke → parent hub link (only for spoke articles)
  if (doc.articleType === "spoke" && doc.hubId !== null) {
    const hasParentLink = doc.internalLinks.some(
      (l) => l.linkType === "spoke-to-hub" || l.targetArticleId === doc.hubId
    );
    results.push(
      createResult(
        CHECK_REGISTRY.W06,
        hasParentLink,
        hasParentLink
          ? "Spoke links to parent hub article"
          : "Spoke does not link to its parent hub article",
        null,
        !hasParentLink
          ? "Add at least one internal link from this spoke article to its parent hub."
          : null
      )
    );
  }

  // W07: Sibling spoke links (1–2 for spoke articles)
  if (doc.articleType === "spoke") {
    const siblingLinks = doc.internalLinks.filter(
      (l) => l.linkType === "spoke-to-sibling"
    );
    const w07Passed = siblingLinks.length >= 1;
    results.push(
      createResult(
        CHECK_REGISTRY.W07,
        w07Passed,
        w07Passed
          ? `${siblingLinks.length} sibling spoke link(s) found`
          : "No sibling spoke links found — add 1–2 links to related spokes",
        null,
        !w07Passed
          ? "Add 1–2 internal links to sibling spoke articles in the same hub."
          : null
      )
    );
  }

  // W08: Cross-cluster link (at least 1)
  const crossClusterLinks = doc.internalLinks.filter(
    (l) => l.linkType === "cross-cluster"
  );
  results.push(
    createResult(
      CHECK_REGISTRY.W08,
      crossClusterLinks.length >= 1,
      crossClusterLinks.length >= 1
        ? `${crossClusterLinks.length} cross-cluster link(s) found`
        : "No cross-cluster links — add at least 1 link to a different hub topic",
      null,
      crossClusterLinks.length < 1
        ? "Add at least one internal link to an article in a different hub cluster."
        : null
    )
  );

  // W10: External links should have target="_blank" in rendered HTML
  const externalAnchors = dom.querySelectorAll('a[href^="http"]');
  const missingBlank = externalAnchors.filter(
    (a) => {
      const href = a.getAttribute("href") || "";
      const isExternal = !href.includes("bhutanwine.com");
      return isExternal && a.getAttribute("target") !== "_blank";
    }
  );
  results.push(
    createResult(
      CHECK_REGISTRY.W10,
      missingBlank.length === 0,
      missingBlank.length === 0
        ? "All external links open in new tab"
        : `${missingBlank.length} external link(s) missing target="_blank"`,
      missingBlank.length > 0 ? "a[href^='http']:not([target='_blank'])" : null,
      missingBlank.length > 0
        ? "Add target=\"_blank\" to all external links."
        : null
    )
  );

  // W11: No competitor e-commerce links
  const competitorLinks = doc.externalLinks.filter((l) =>
    COMPETITOR_DOMAINS.some((domain) => l.url.includes(domain))
  );
  results.push(
    createResult(
      CHECK_REGISTRY.W11,
      competitorLinks.length === 0,
      competitorLinks.length === 0
        ? "No competitor e-commerce links"
        : `Found competitor link: ${competitorLinks[0].url}`,
      null,
      competitorLinks.length > 0
        ? `Remove or replace the competitor link to ${competitorLinks[0].url}.`
        : null
    )
  );

  // W12: External link spread — not clustered in 1–2 sections
  const sectionIds = new Set(doc.externalLinks.map((l) => l.sectionId));
  const w12Passed = doc.externalLinks.length <= 2 || sectionIds.size >= 3;
  results.push(
    createResult(
      CHECK_REGISTRY.W12,
      w12Passed,
      w12Passed
        ? `External links spread across ${sectionIds.size} section(s)`
        : `External links clustered in only ${sectionIds.size} section(s) — spread across at least 3`,
      null,
      !w12Passed
        ? "Distribute external links more evenly across article sections."
        : null
    )
  );

  // W13: Source trust tiers — at least 1 primary source
  const hasPrimary = doc.externalLinks.some(
    (l) => l.trustTier === "primary"
  );
  results.push(
    createResult(
      CHECK_REGISTRY.W13,
      hasPrimary,
      hasPrimary
        ? "At least 1 primary source link present"
        : "No primary source links — add at least 1 high-authority source",
      null,
      !hasPrimary
        ? "Add at least one external link to a primary source (government, academic, or industry body)."
        : null
    )
  );

  return results;
}
