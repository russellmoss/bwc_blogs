import { prisma } from "@/lib/db";
import { renderArticle } from "@/lib/renderer";
import { TEMPLATE_VERSION } from "@/lib/renderer/compiled-template";
import { runQAChecks, CheerioDomAdapter } from "@/lib/qa";
import { downloadFromDrive } from "@/lib/cloudinary/drive-downloader";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import type { CanonicalArticleDocument, ImagePlacement } from "@/types/article";
import type { HtmlOverride, RendererOutput } from "@/types/renderer";
import type { QAScore } from "@/types/qa";

// ---------- Photo Promotion ----------

interface PhotoPromotionResult {
  updatedDocument: CanonicalArticleDocument;
  photosUploaded: number;
}

export async function promotePendingPhotos(
  document: CanonicalArticleDocument
): Promise<PhotoPromotionResult> {
  const updatedDoc = structuredClone(document);
  let photosUploaded = 0;

  // Collect all ImagePlacement nodes
  const placements: { ref: ImagePlacement; path: string }[] = [];

  if (updatedDoc.heroImage?.photoId) {
    placements.push({ ref: updatedDoc.heroImage, path: "heroImage" });
  }

  for (let si = 0; si < updatedDoc.sections.length; si++) {
    for (let ci = 0; ci < updatedDoc.sections[si].content.length; ci++) {
      const node = updatedDoc.sections[si].content[ci];
      if (node.type === "image" && node.placement.photoId) {
        placements.push({
          ref: node.placement,
          path: `sections[${si}].content[${ci}].placement`,
        });
      }
    }
  }

  // Upload each un-promoted photo
  for (const { ref } of placements) {
    if (!ref.photoId) continue;

    const photo = await prisma.photo.findUnique({
      where: { id: ref.photoId },
    });
    if (!photo) continue;

    if (photo.uploadedToCdn && photo.cloudinaryPublicId) {
      // Already on CDN — just update the document node
      ref.cloudinaryPublicId = photo.cloudinaryPublicId;
      ref.src = photo.cloudinaryUrl || ref.src;
      continue;
    }

    if (!photo.driveFileId) continue; // Can't upload without Drive source

    // Download from Drive and upload to Cloudinary
    const buffer = await downloadFromDrive(photo.driveFileId);
    const baseName = photo.filename.replace(/\.[^.]+$/, "");
    const category = photo.category || "uncategorized";
    const publicId = `blog/${category}/${baseName}`;

    const result = await uploadToCloudinary(buffer, { publicId });

    // Update photos table
    await prisma.photo.update({
      where: { id: photo.id },
      data: {
        cloudinaryPublicId: result.publicId,
        cloudinaryUrl: result.secureUrl,
        widthPx: result.width,
        heightPx: result.height,
        uploadedToCdn: true,
      },
    });

    // Update the document node
    ref.cloudinaryPublicId = result.publicId;
    ref.src = result.secureUrl;
    if (result.width) ref.width = result.width;
    if (result.height) ref.height = result.height;
    photosUploaded++;
  }

  return { updatedDocument: updatedDoc, photosUploaded };
}

// ---------- Atomic Commit ----------

interface CommitResult {
  documentVersion: number;
  htmlVersion: number;
  rendererOutput: RendererOutput;
  qaScore: QAScore;
}

export async function commitFinalization(
  articleId: number,
  document: CanonicalArticleDocument,
  htmlOverrides: HtmlOverride[] | null,
  userEmail: string,
  notes?: string
): Promise<CommitResult> {
  // 1. Final render
  const rendererOutput = renderArticle({
    document,
    htmlOverrides,
    templateVersion: TEMPLATE_VERSION,
  });

  // 2. Server-side QA
  const dom = new CheerioDomAdapter(rendererOutput.html);
  const qaScore = runQAChecks(document, rendererOutput.html, dom);

  if (!qaScore.canFinalize) {
    const err = new Error(
      `QA_GATE_FAILED: ${qaScore.failCount} FAIL-level issue(s) block finalization`
    );
    (err as any).qaScore = qaScore;
    throw err;
  }

  // 3. Determine next version
  const latestDoc = await prisma.articleDocument.findFirst({
    where: { articleId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latestDoc?.version || 0) + 1;

  // 4. Atomic commit
  await prisma.$transaction(async (tx) => {
    await tx.articleDocument.create({
      data: {
        articleId,
        version: nextVersion,
        canonicalDoc: document as any,
        htmlOverrides: htmlOverrides as any,
        finalizedBy: userEmail,
        notes: notes || null,
      },
    });

    await tx.articleHtml.create({
      data: {
        articleId,
        version: nextVersion,
        documentVersion: nextVersion,
        htmlContent: rendererOutput.html,
        metaTitle: rendererOutput.metaTitle,
        metaDescription: rendererOutput.metaDescription,
        schemaJson: rendererOutput.schemaJson,
        qaScore: `${qaScore.total}/${qaScore.possible}`,
        qaFailures: qaScore.failCount,
        finalizedBy: userEmail,
        notes: notes || null,
      },
    });

    await tx.contentMap.update({
      where: { id: articleId },
      data: {
        status: "finalized",
        wordCount: rendererOutput.wordCount,
        qaScore: `${qaScore.total}/${qaScore.possible}`,
      },
    });
  });

  return {
    documentVersion: nextVersion,
    htmlVersion: nextVersion,
    rendererOutput,
    qaScore,
  };
}

// ---------- Backfill Report ----------

export interface BackfillSuggestion {
  existingArticleId: number;
  existingArticleTitle: string;
  existingArticleSlug: string | null;
  existingArticleUrl: string | null;
  suggestedAnchorText: string;
  reason: string;
}

export async function generateBackfillReport(
  articleId: number
): Promise<BackfillSuggestion[]> {
  // Get the newly published article
  const article = await prisma.contentMap.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      slug: true,
      mainEntity: true,
      targetKeywords: true,
      hubName: true,
    },
  });
  if (!article) return [];

  // Get all OTHER published articles
  const published = await prisma.contentMap.findMany({
    where: {
      status: "published",
      id: { not: articleId },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      publishedUrl: true,
      mainEntity: true,
      targetKeywords: true,
      hubName: true,
    },
  });

  const suggestions: BackfillSuggestion[] = [];
  const articleKeywords = new Set(
    article.targetKeywords.map((k) => k.toLowerCase())
  );
  const articleEntity = article.mainEntity.toLowerCase();

  for (const other of published) {
    const otherKeywords = other.targetKeywords.map((k) => k.toLowerCase());
    const otherEntity = other.mainEntity.toLowerCase();

    // Check keyword overlap
    const sharedKeywords = otherKeywords.filter((k) => articleKeywords.has(k));

    // Check entity overlap
    const entityMatch =
      otherEntity.includes(articleEntity) ||
      articleEntity.includes(otherEntity);

    // Check same hub
    const sameHub = other.hubName === article.hubName;

    if (sharedKeywords.length > 0 || entityMatch || sameHub) {
      const reason = sharedKeywords.length > 0
        ? `Shares keyword: ${sharedKeywords[0]}`
        : entityMatch
          ? `Related entity: ${other.mainEntity}`
          : `Same hub: ${other.hubName}`;

      suggestions.push({
        existingArticleId: other.id,
        existingArticleTitle: other.title,
        existingArticleSlug: other.slug,
        existingArticleUrl: other.publishedUrl,
        suggestedAnchorText: article.title.length > 60
          ? article.title.substring(0, 57) + "..."
          : article.title,
        reason,
      });
    }
  }

  return suggestions;
}

// ---------- Link Activation ----------

export async function activateLinks(articleId: number): Promise<number> {
  // Get all published article IDs
  const publishedArticles = await prisma.contentMap.findMany({
    where: { status: "published" },
    select: { id: true },
  });
  const publishedIds = new Set(publishedArticles.map((a) => a.id));

  // Find links involving this article where BOTH ends are published
  const links = await prisma.internalLink.findMany({
    where: {
      OR: [
        { sourceArticleId: articleId },
        { targetArticleId: articleId },
      ],
      isActive: false,
    },
  });

  let activated = 0;
  for (const link of links) {
    const sourceOk = !link.sourceArticleId || publishedIds.has(link.sourceArticleId);
    const targetOk = !link.targetArticleId || publishedIds.has(link.targetArticleId);
    // Core page links (targetCorePage != null) are always activatable
    const isCorePageLink = !!link.targetCorePage;

    if ((sourceOk && targetOk) || isCorePageLink) {
      await prisma.internalLink.update({
        where: { id: link.id },
        data: { isActive: true },
      });
      activated++;
    }
  }

  return activated;
}
