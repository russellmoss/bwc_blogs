import type { CanonicalArticleDocument } from "@/types/article";
import { buildCloudinaryUrl } from "./cloudinary";

/**
 * Build JSON-LD schema blocks from the canonical document metadata.
 * Returns a string containing one or more <script type="application/ld+json"> blocks.
 */
export function buildSchemaJson(doc: CanonicalArticleDocument): string {
  const blocks: string[] = [];

  // BlogPosting (always present — enforced by validation)
  if (doc.schema.blogPosting) {
    const heroUrl = doc.heroImage
      ? (doc.heroImage.cloudinaryPublicId
          ? buildCloudinaryUrl(doc.heroImage.cloudinaryPublicId, { width: 1200 })
          : doc.heroImage.src)
      : undefined;

    const blogPosting: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: doc.title,
      datePublished: doc.publishDate,
      dateModified: doc.modifiedDate,
      author: {
        "@type": "Person",
        name: doc.author.name,
        ...(doc.author.credentials && { jobTitle: doc.author.credentials }),
        ...(doc.author.linkedinUrl && { url: doc.author.linkedinUrl }),
      },
      publisher: {
        "@type": "Organization",
        name: "Bhutan Wine Company",
        url: "https://www.bhutanwine.com",
      },
      description: doc.metaDescription,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": doc.canonicalUrl,
      },
    };

    if (heroUrl) {
      blogPosting.image = heroUrl;
    }

    blocks.push(
      `<script type="application/ld+json">\n${JSON.stringify(blogPosting, null, 2)}\n</script>`
    );
  }

  // FAQPage (only when faq items exist and flag is true)
  if (doc.schema.faqPage && doc.faq.length > 0) {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: doc.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    };

    blocks.push(
      `<script type="application/ld+json">\n${JSON.stringify(faqSchema, null, 2)}\n</script>`
    );
  }

  return blocks.join("\n");
}
