import type { CanonicalArticleDocument } from "@/types/article";
import type { QAResult } from "@/types/qa";
import type { DomAdapter } from "../engine";
import { CHECK_REGISTRY, createResult } from "../engine";
import { countWords } from "@/lib/article-schema/validate";

export function runImageChecks(
  doc: CanonicalArticleDocument,
  dom: DomAdapter
): QAResult[] {
  const results: QAResult[] = [];

  // Count all images in document
  let imageCount = doc.heroImage ? 1 : 0;
  for (const section of doc.sections) {
    for (const node of section.content) {
      if (node.type === "image") imageCount++;
    }
  }

  // W14: Image count minimum
  const imgMins: Record<string, number> = { hub: 5, spoke: 3, news: 1 };
  const imgMin = imgMins[doc.articleType] || 1;
  results.push(
    createResult(
      CHECK_REGISTRY.W14,
      imageCount >= imgMin,
      imageCount >= imgMin
        ? `${imageCount} images (minimum: ${imgMin} for ${doc.articleType})`
        : `Only ${imageCount} image(s) — ${doc.articleType} articles need at least ${imgMin}`,
      null,
      imageCount < imgMin
        ? `Add more images. ${doc.articleType} articles need at least ${imgMin} images, currently has ${imageCount}.`
        : null
    )
  );

  // W15: ≤400 consecutive words without image
  let maxGap = 0;
  let currentGap = 0;
  for (const section of doc.sections) {
    currentGap += countWords(section.heading);
    for (const node of section.content) {
      if (node.type === "image") {
        maxGap = Math.max(maxGap, currentGap);
        currentGap = 0;
      } else if (node.type === "paragraph" || node.type === "pullQuote" || node.type === "callout") {
        currentGap += countWords(node.text);
      } else if (node.type === "list") {
        for (const item of node.items) {
          currentGap += countWords(item);
        }
      } else if (node.type === "keyFacts") {
        for (const fact of node.facts) {
          currentGap += countWords(fact.label) + countWords(fact.value);
        }
      } else if (node.type === "table") {
        for (const row of node.rows) {
          for (const cell of row) {
            currentGap += countWords(cell);
          }
        }
      }
    }
  }
  maxGap = Math.max(maxGap, currentGap);
  results.push(
    createResult(
      CHECK_REGISTRY.W15,
      maxGap <= 400,
      maxGap <= 400
        ? `Max consecutive words without image: ${maxGap} (limit: 400)`
        : `${maxGap} consecutive words without an image — max allowed is 400`,
      null,
      maxGap > 400
        ? `Add an image to break up the text. There are ${maxGap} consecutive words without a visual break.`
        : null
    )
  );

  // W17: Captions on location/process images
  const uncaptionedImages: string[] = [];
  for (const section of doc.sections) {
    for (const node of section.content) {
      if (node.type === "image" && node.placement.classification === "informative") {
        if (!node.placement.caption) {
          uncaptionedImages.push(node.placement.alt.slice(0, 40));
        }
      }
    }
  }
  results.push(
    createResult(
      CHECK_REGISTRY.W17,
      uncaptionedImages.length === 0,
      uncaptionedImages.length === 0
        ? "All informative images have captions"
        : `${uncaptionedImages.length} informative image(s) without caption`,
      null,
      uncaptionedImages.length > 0
        ? `Add captions to informative images. First uncaptioned: "${uncaptionedImages[0]}..."`
        : null
    )
  );

  // W20: Hero image performance — loading="eager" + fetchpriority="high"
  const heroImgs = dom.querySelectorAll("img");
  if (heroImgs.length > 0) {
    const firstImg = heroImgs[0];
    const hasEager = firstImg.getAttribute("loading") === "eager";
    const hasPriority = firstImg.getAttribute("fetchpriority") === "high";
    const w20Passed = hasEager && hasPriority;
    results.push(
      createResult(
        CHECK_REGISTRY.W20,
        w20Passed,
        w20Passed
          ? "Hero image has loading=\"eager\" and fetchpriority=\"high\""
          : `Hero image missing: ${!hasEager ? 'loading="eager"' : ""} ${!hasPriority ? 'fetchpriority="high"' : ""}`.trim(),
        "img:first-of-type",
        !w20Passed
          ? "Add loading=\"eager\" and fetchpriority=\"high\" to the hero image for optimal LCP."
          : null
      )
    );
  }

  // W21: All images have width + height attributes in DOM
  const allImgs = dom.querySelectorAll("img");
  const missingDims = allImgs.filter(
    (img) => !img.getAttribute("width") || !img.getAttribute("height")
  );
  results.push(
    createResult(
      CHECK_REGISTRY.W21,
      missingDims.length === 0,
      missingDims.length === 0
        ? `All ${allImgs.length} images have width and height attributes`
        : `${missingDims.length} image(s) missing width/height attributes (CLS risk)`,
      missingDims.length > 0 ? "img:not([width])" : null,
      missingDims.length > 0
        ? "Add explicit width and height attributes to all images to prevent layout shift."
        : null
    )
  );

  return results;
}
