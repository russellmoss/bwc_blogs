# Code Inspector Findings — Guide 11: Finalization, Publishing Flow & Link Backfilling

Generated: 2026-03-02
Inspector: read-only codebase investigation

---

## 1. Prisma Schema State

File: prisma/schema.prisma

### model ArticleDocument (article_documents table)

- id: Int @id autoincrement — PK
- articleId: Int map("article_id") — FK to content_map.id
- version: Int default(1)
- canonicalDoc: Json map("canonical_doc") — CanonicalArticleDocument as JSON
- htmlOverrides: Json? map("html_overrides") — optional HtmlOverride[]
- finalizedAt: DateTime default(now()) map("finalized_at")
- finalizedBy: String? map("finalized_by") — nullable user email
- notes: String?

Unique constraint: @@unique([articleId, version])
