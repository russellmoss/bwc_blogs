import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { parseCSV, mapCSVRow } from "../src/lib/content-map/import";
import { ensureUniqueSlug } from "../src/lib/content-map/slug";

const prisma = new PrismaClient();

// ─── Core BWC pages for internal linking ────────────────────────────
const CORE_PAGES = [
  "https://www.bhutanwine.com/the-grapes-vineyards",
  "https://www.bhutanwine.com/our-wine",
  "https://www.bhutanwine.com/our-wine-2023-first-barrel",
  "https://www.bhutanwine.com/first-release",
  "https://www.bhutanwine.com/visit-us",
  "https://www.bhutanwine.com/about-us",
  "https://www.bhutanwine.com/in-the-news",
  "https://www.bhutanwine.com/gallery",
  "https://www.bhutanwine.com/2024-inquiry-request",
  "https://www.bhutanwine.com/contact-us",
];

async function main() {
  // ─── Guide 1: Seed admin user ───────────────────────────────────
  const email = (process.env.ADMIN_EMAIL || "russell@bhutanwine.com").toLowerCase();
  const name = process.env.ADMIN_NAME || "Russell Moss";
  const password = process.env.ADMIN_PASSWORD || "changeme123";

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "admin", isActive: true },
    create: { email, name, passwordHash, role: "admin", isActive: true },
  });

  console.log(`Admin user seeded: ${admin.email} (id: ${admin.id})`);

  // ─── Guide 2: Seed content map from CSV ─────────────────────────
  const contentMapCount = await prisma.contentMap.count();

  if (contentMapCount > 0) {
    console.log(`Content map already seeded (${contentMapCount} rows). Skipping.`);
  } else {
    const csvPath = path.join(__dirname, "..", "data", "content-map.csv");
    const csvText = fs.readFileSync(csvPath, "utf-8");
    const rawRows = parseCSV(csvText);
    const mappedRows = rawRows.map(mapCSVRow);

    const hubs = mappedRows.filter((r) => r.articleType === "hub");
    const spokes = mappedRows.filter((r) => r.articleType === "spoke");

    // Insert hubs first
    const hubIdMap = new Map<string, number>();

    for (const hub of hubs) {
      const slug = await ensureUniqueSlug(hub.slug, prisma);
      const created = await prisma.contentMap.create({
        data: {
          hubName: hub.hubName,
          articleType: hub.articleType,
          title: hub.title,
          slug,
          mainEntity: hub.mainEntity,
          supportingEntities: hub.supportingEntities,
          targetKeywords: hub.targetKeywords,
          searchVolumeEst: hub.searchVolumeEst,
          keywordDifficulty: hub.keywordDifficulty,
          targetAudience: hub.targetAudience,
          contentNotes: hub.contentNotes,
          suggestedExternalLinks: hub.suggestedExternalLinks,
          internalLinksTo: hub.internalLinksTo,
          status: hub.status,
          source: hub.source,
        },
        select: { id: true, hubName: true },
      });
      hubIdMap.set(created.hubName, created.id);
    }

    console.log(`  Hubs inserted: ${hubs.length}`);

    // Insert spokes with parent hub FK
    for (const spoke of spokes) {
      const slug = await ensureUniqueSlug(spoke.slug, prisma);
      const parentHubId = hubIdMap.get(spoke.hubName) ?? null;

      await prisma.contentMap.create({
        data: {
          hubName: spoke.hubName,
          articleType: spoke.articleType,
          title: spoke.title,
          slug,
          mainEntity: spoke.mainEntity,
          supportingEntities: spoke.supportingEntities,
          targetKeywords: spoke.targetKeywords,
          searchVolumeEst: spoke.searchVolumeEst,
          keywordDifficulty: spoke.keywordDifficulty,
          targetAudience: spoke.targetAudience,
          contentNotes: spoke.contentNotes,
          suggestedExternalLinks: spoke.suggestedExternalLinks,
          internalLinksTo: spoke.internalLinksTo,
          status: spoke.status,
          source: spoke.source,
          parentHubId,
        },
      });
    }

    console.log(`  Spokes inserted: ${spokes.length}`);
    console.log(`Content map seeded: ${hubs.length + spokes.length} total rows`);
  }

  // ─── Guide 2: Seed core BWC pages into internal_links ──────────
  const corePageCount = await prisma.internalLink.count({
    where: { linkType: "to-core-page" },
  });

  if (corePageCount > 0) {
    console.log(`Core pages already seeded (${corePageCount} rows). Skipping.`);
  } else {
    for (const url of CORE_PAGES) {
      await prisma.internalLink.create({
        data: {
          targetCorePage: url,
          linkType: "to-core-page",
          isActive: true,
        },
      });
    }
    console.log(`Core pages seeded: ${CORE_PAGES.length} internal link rows`);
  }

  // ─── Writing Styles: Seed 4 default styles ──────────────────────
  const SEED_STYLES = [
    {
      name: "BWC Default — Luxury Editorial",
      slug: "luxury-editorial",
      description: "Confident, measured, luxury wine register",
      isDefault: true,
      content: `# Luxury Editorial Voice

Write as if narrating the founding of a wine region that will be studied
for generations. Not breathlessly. Not with false modesty. With the quiet
confidence of someone who knows the significance of what they are building.

## Sentence Rhythm
- Alternate short declaratives with longer, layered constructions
- Average sentence length: 15-20 words
- Use fragments sparingly but deliberately for emphasis

## Vocabulary
- Precise over ornate. "Laterite" not "reddish soil." "Veraison" not "color change."
- Explain technical terms on first use with a brief subordinate clause
- Avoid superlatives unless backed by specific data

## Perspective
- First-person plural ("we," "our") for BWC operations
- Third-person for industry context and external research
- Never use exclamation points in body text

## Emotional Register
- Confident, measured, subtly reverent
- The reader should feel they are being trusted with something significant
- Let specificity carry the emotional weight, not adjectives

## Avoid
- "In this article, we will explore..."
- "It's worth noting that..."
- Filler transitions: "Furthermore," "Additionally," "Moreover"
- Breathless marketing language`,
    },
    {
      name: "Narrative Storyteller",
      slug: "narrative-storyteller",
      description: "Sensory-rich, scene-driven, immersive",
      isDefault: false,
      content: `# Narrative Storyteller Voice

Write as if telling a story around a table with a glass of wine in hand.
Sensory-rich, human-centered, driven by moments rather than data points.
The reader should feel transported to the vineyard.

## Sentence Rhythm
- Lead with scene-setting: time of day, weather, physical sensation
- Use present tense for immersive moments, past tense for context
- Shorter paragraphs -- 2-3 sentences maximum
- Let single-sentence paragraphs land key moments

## Vocabulary
- Favor sensory language: texture, sound, temperature, color, scent
- Use proper nouns -- name the valley, the river, the person
- Technical terms are fine but always grounded in physical reality:
  "veraison -- the moment the grapes blush from green to violet"

## Perspective
- Second person ("you") is acceptable for immersive passages:
  "You can feel the temperature drop as the sun dips behind the ridge"
- First-person plural for BWC team moments
- Name specific people when recounting events

## Emotional Register
- Warm, vivid, intimate
- The reader is a guest, not a student
- Wonder over analysis -- but always anchored in real detail

## Avoid
- Abstract claims without sensory grounding
- Data dumps without narrative framing
- Passive voice (almost always)
- Explaining what the reader should feel -- show it instead`,
    },
    {
      name: "Wine Critic / Technical Authority",
      slug: "wine-critic-technical-authority",
      description: "Technical, data-dense, analytical",
      isDefault: false,
      content: `# Wine Critic / Technical Authority Voice

Write as a senior wine critic or viticulture researcher would for a
trade publication. Data-dense, analytical, authoritative. The reader is
a professional who values precision over narrative.

## Sentence Rhythm
- Lead with facts, follow with interpretation
- Longer sentences acceptable when building technical arguments
- Use semicolons to connect related technical claims
- Data parentheticals are encouraged: "(12.5% ABV, 3.2 g/L TA, pH 3.38)"

## Vocabulary
- Full technical vocabulary without apology or explanation
- Varietal names, soil classifications, viticultural terms used freely
- Comparative language: "comparable to," "exceeding," "in contrast with"
- Specific over general: elevation in meters, yields in tons/hectare

## Perspective
- Third-person analytical: "The vineyard demonstrates..."
- First-person plural only when citing BWC proprietary data
- Reference published research by author and year when available

## Emotional Register
- Measured, precise, evaluative
- Conclusions are earned through evidence, not asserted
- Skepticism and nuance are strengths -- acknowledge limitations
- The reader trusts you because you don't oversell

## Avoid
- Marketing language of any kind
- "Unique" without qualification
- Sensory descriptions that can't be verified
- Hedging when data supports a clear conclusion`,
    },
    {
      name: "Accessible Wine Enthusiast",
      slug: "accessible-wine-enthusiast",
      description: "Warm, curious, defines terms naturally",
      isDefault: false,
      content: `# Accessible Wine Enthusiast Voice

Write for the curious reader who loves wine but isn't in the industry.
They read Wine Enthusiast, watch sommelier content, and travel to wine
regions -- but they don't have a WSET certification. Make them feel smart,
not talked down to.

## Sentence Rhythm
- Short paragraphs, punchy sentences
- One idea per paragraph
- Use analogies to familiar experiences:
  "Think of diurnal temperature swing like a pressure cooker for flavor"
- Break up technical passages with conversational asides

## Vocabulary
- Use technical terms but always define them naturally on first use
- Prefer concrete comparisons: "the altitude of Denver" not "1,600 meters"
- Food and travel vocabulary welcome -- these readers think in experiences

## Perspective
- Second-person inclusive: "When you taste..." "If you've ever visited..."
- First-person plural for BWC: "Our vineyards sit at..."
- Direct address is fine: "Here's what makes this interesting."

## Emotional Register
- Enthusiastic but grounded
- The energy of a friend who just got back from an incredible trip
- Curious, generous, never condescending
- OK to express excitement through specificity (not exclamation points)

## Avoid
- Jargon without explanation
- Assuming the reader knows grape varieties by sight
- Dense paragraphs of technical data without breathing room
- Sounding like a textbook or a press release`,
    },
  ];

  for (const style of SEED_STYLES) {
    await prisma.writingStyle.upsert({
      where: { slug: style.slug },
      update: {
        name: style.name,
        description: style.description,
        content: style.content,
        isDefault: style.isDefault,
        isSeed: true,
      },
      create: {
        name: style.name,
        slug: style.slug,
        description: style.description,
        content: style.content,
        isDefault: style.isDefault,
        isSeed: true,
      },
    });
  }

  console.log(`Writing styles seeded: ${SEED_STYLES.length} styles`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
