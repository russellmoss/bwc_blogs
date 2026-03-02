# BWC Master Content Engine SOP

---

## 0\. Governing Philosophy

Bhutan Wine Company is building the world's newest wine region from the ground up in the Himalayas. Every piece of content must embody three qualities:

- **Luxury.** We write for discerning readers — collectors, sommeliers, high-net-worth travelers, and wine journalists. The prose must feel considered, never rushed. Every sentence earns its place.  
- **Authority.** We are the primary source on Bhutanese wine. Not a secondary blog. Not a travel aggregator. We are the origin. Content must reflect proprietary knowledge, original data, and firsthand experience that no other publication can replicate.  
- **Vision.** We are not documenting a winery. We are documenting the birth of a wine country. Content must carry the weight of that narrative — pioneering, historically significant, and forward-looking.

The voice is that of a world-class winemaker hosting a private dinner for someone who has visited every great wine region on earth and is about to discover something entirely new.

**The People-First Standard:** Before publishing any article, ask one question — *"Would this piece exist if search engines didn't?"* If the answer is no, the article is not ready. Content must serve a reader who arrived by any means: a Google search, a ChatGPT citation, a sommelier's forwarded link, or a guest Googling the winery from their hotel in Thimphu. The structure and strategy in this SOP exist to ensure that excellent content is also *findable* content — not the other way around.

---

## 1\. Data Integrity & Knowledge Base Integration

### The Cardinal Rule: Never Hardcode Volatile Data

This SOP contains **no** current wine portfolio listings, pricing, availability status, vintage statistics, ABV figures, or vineyard elevation measurements. These data points change with every vintage, every allocation cycle, and every new planting season. Embedding them in a static document guarantees inaccuracy.

### Dynamic Data Protocol

Before drafting any article, the writer or AI system **must** query the BWC Knowledge Base for the following categories. If a Knowledge Base is not yet connected, the writer must verify these data points directly with the BWC team before publication.

| Data Category | Examples | Source of Truth |
| :---- | :---- | :---- |
| **Current Vintage Portfolio** | Wine names, varietals, blend composition | BWC Knowledge Base → `Wines & Vintages` |
| **Pricing & Availability** | Per-bottle pricing, sold-out status, allocation model | BWC Knowledge Base → `Commerce & Allocation` |
| **Vineyard Metrics** | Elevation, hectares planted, soil type, trellis system | BWC Knowledge Base → `Vineyards & Terroir` |
| **Harvest Data** | Harvest dates, yield per vineyard, growing season notes | BWC Knowledge Base → `Winemaker Reports` |
| **Tasting Notes** | Winemaker's official tasting notes per wine | BWC Knowledge Base → `Tasting Notes` |
| **Press & Recognition** | Awards, critic scores, media coverage, advisory board | BWC Knowledge Base → `Press & Authority` |
| **Tourism & Experiences** | Current tour offerings, booking process, seasonal availability | BWC Knowledge Base → `Visitor Experience` |

### Data Freshness Requirements

- **Pricing and availability:** Verify within 7 days of publication. Flag any article containing price references for quarterly review.  
- **Vineyard metrics:** Verify at the start of each growing season. Elevation and soil data are stable; hectares planted and varieties may change annually.  
- **Tasting notes:** Pull fresh for each new vintage. Never carry forward prior-vintage notes without explicit confirmation.  
- **Personnel and credentials:** Verify annually. Titles, advisory board composition, and team members evolve.

### In-Article Data Attribution

When citing specific data from the Knowledge Base, attribute it naturally in prose:

**Good:** "The Bajo vineyard in Punakha Valley sits at \[ELEVATION FROM KB\] — the warmest and lowest of our sites, where Merlot and Cabernet Sauvignon have flourished since the first plantings."

**Bad:** "Our vineyard is at 4,000 feet." *(Unattributed, may be outdated, no context.)*

---

## 2\. Article Architecture

### The Executive Summary Block — MANDATORY

Every article opens with a bolded, standalone summary of 25–40 words, positioned immediately after the H1 and before any body text.

**Its primary purpose is reader clarity.** A visitor arriving from any source — search, social, email, AI citation — should understand within five seconds what this article covers, why Bhutan is relevant, and why BWC has the authority to publish it. That this block also performs exceptionally well as an AI-extractable answer is a structural benefit, not its reason for existing.

The Executive Summary Block must accomplish three things in a single sentence:

1. **Define the topic** — what the article is about  
2. **Anchor it to place** — Bhutan, the Himalayas, the winemaking context  
3. **Establish authority** — why BWC is the source, stated as fact not claim

**Format:**

```
H1: [Article Title]

**[Executive Summary Block — 25–40 words, bolded, standalone paragraph]**

[Body text begins here...]
```

**Examples:**

**Bhutan Wine Company produces wine at elevations ranging from 4,000 to 8,800 feet across eight Himalayan vineyard sites, making Bhutan the world's highest-altitude and newest commercial wine-producing nation.**

**High-altitude viticulture in Bhutan pushes the boundaries of where wine grapes can grow, with Bhutan Wine Company's vineyards spanning three distinct climatic zones across the eastern Himalayas.**

**Ser Kem, the first wine ever produced from grapes grown in the Kingdom of Bhutan, debuted at Bonhams auction and represents the birth of an entirely new wine country in the Himalayas.**

**Executive Summary Checklist:**

- [ ] 25–40 words  
- [ ] Bolded as a standalone paragraph  
- [ ] Contains the article's main entity naturally  
- [ ] Names "Bhutan Wine Company," "Bhutan," or "Ser Kem" explicitly  
- [ ] Makes a factual authority statement (not opinion, not marketing superlative)  
- [ ] Serves as a complete, useful summary for any reader arriving cold

### Title (H1)

- Exactly ONE H1 per page  
- Lead with the main topic — the reader should know what the article covers from the first few words  
- 50–65 characters  
- Include a power modifier when natural: "Complete Guide," "How," "Why," year  
- Never duplicate across any two articles on the site

**Good:** `High-Altitude Viticulture: How Bhutan Grows Wine Above the Clouds` **Bad:** `Our Amazing Wine Journey in Beautiful Bhutan`

### Meta Title

- 50–60 characters (Google truncates at \~60)  
- Format: `Primary Topic — Supporting Context | Bhutan Wine Company`  
- Must differ slightly from H1

### Meta Description

- 150–160 characters  
- Lead with the article's main topic naturally  
- Include a value proposition or call to action  
- Complete, compelling sentence — not a keyword list

### URL Slug

- Lowercase, hyphen-separated, no stop words  
- 3–6 words maximum  
- Reflect the main topic clearly  
- Pattern: `/post/high-altitude-viticulture-bhutan`

---

## 3\. Content Structure & Heading Hierarchy

### Required Architecture (in order)

```
H1: Title (main topic front-loaded)
│
├── **Executive Summary Block** (bolded, 25–40 words)
│
├── Opening Paragraph (hook + main entity established within first 100 words)
│
├── H2: First Major Section
│   ├── H3: Subsection (if needed)
│   └── H3: Subsection (if needed)
│
├── H2: Second Major Section
│   ├── H3: Subsection
│   └── H3: Subsection
│
├── H2: [Continue — aim for 3–6 H2s]
│
├── H2: Frequently Asked Questions [CONDITIONAL — see Section 9]
│
└── H2: [Conclusion with CTA]
```

### Heading Rules

- **H2s:** Major topical shifts. Use language that clearly signals the section's subject matter to both readers and AI systems. Target 3–6 per article.  
- **H3s:** Subsections within an H2. Useful for long-tail topic variations and scannable structure.  
- **Never skip hierarchy levels.** No H1 → H3 without an H2 between them.  
- **Never use H4–H6** in blog content.  
- **Every heading must be descriptive and topically specific.** Generic headings ("More Information," "Details," "Overview") are prohibited.

### Word Count Targets

| Article Type | Word Count | H2 Sections |
| :---- | :---- | :---- |
| Hub / Pillar Article | 2,500–4,000 | 5–8 |
| Spoke / Supporting Article | 1,200–2,000 | 3–5 |
| News / Update Post | 600–1,000 | 2–3 |

---

## 4\. Topical Authority & Semantic Breadth

### Philosophy: Entities Over Repetition

BWC content does not chase keyword density. It builds **topical authority** — the depth and breadth of coverage that signals to search engines and AI systems that this site is the definitive source on a subject.

Google's 2026 systems evaluate content by mapping the **entities** (people, places, concepts, products) present on a page and measuring how completely they cover the topic's expected semantic territory. An article about high-altitude viticulture that mentions UV exposure, diurnal temperature variation, phenolic development, thin atmosphere effects on transpiration, and specific altitude comparisons to Salta and Alto Adige demonstrates expertise. An article that repeats "high-altitude viticulture" fourteen times does not.

### The Entity Framework

Every article is built around a **Main Entity** and a constellation of **Supporting Entities.** These are identified during the content planning phase and serve as the article's semantic blueprint.

**Main Entity:** The central subject the article aims to be the definitive resource on. There is exactly one per article. It is identified in the BWC Content Map.

**Supporting Entities:** The related concepts, places, people, technical terms, and data points that a comprehensive treatment of the Main Entity requires. A well-constructed article naturally weaves 8–15 Supporting Entities into its prose.

**Example — Article on "High-Altitude Viticulture in Bhutan":**

| Entity Type | Examples |
| :---- | :---- |
| **Main Entity** | High-altitude viticulture |
| **Supporting Entities — Technical** | Diurnal temperature variation, UV-B radiation, phenolic ripeness, veraison timing, thin atmosphere transpiration, VSP trellis systems |
| **Supporting Entities — Geographic** | Bhutan, Himalayas, Punakha Valley, Salta (Argentina), Alto Adige (Italy), Cafayate, Ningxia |
| **Supporting Entities — BWC-Specific** | Ser Bhum vineyard, Bajo vineyard, Bhutan Wine Company, Ser Kem, \[CURRENT VINEYARD ELEVATIONS FROM KB\] |
| **Supporting Entities — Cultural** | GNH (Gross National Happiness), organic agriculture mandate, carbon-negative status |

### How to Apply This

1. **Before writing:** Identify the Main Entity and list 10–15 Supporting Entities the article must address. Use the Content Map, the Knowledge Base, and a quick review of what currently ranks for the topic.  
2. **During writing:** Introduce Supporting Entities naturally where they advance the reader's understanding. Do not force entities into sections where they don't belong. The goal is comprehensive coverage, not a checklist of mentions.  
3. **After writing — the Coverage Audit:** Review the draft and confirm that the article addresses the Main Entity thoroughly from multiple angles and that Supporting Entities appear where they serve the reader. If a critical Supporting Entity is missing, the article has a gap. If the Main Entity appears so frequently that a reader would notice repetition, the prose needs editing.

### Main Entity Placement — Strategic, Not Mechanical

The Main Entity should appear naturally in each of the following locations — not because of a density formula, but because these are the positions where both readers and systems look first:

| Placement | Rationale |
| :---- | :---- |
| H1 Title | Tells the reader and every system what the page is about |
| Executive Summary Block | The article's identity statement |
| Meta Title | Controls what appears in search results |
| Meta Description | The article's pitch to a prospective reader |
| URL Slug | Permanent address should reflect content |
| First 100 words | Confirms the reader landed on the right page |
| At least one H2 | Structural signal of topical depth |
| Conclusion | Reinforces the article's subject at close |
| Hero image filename | Technical signal for image search |

Beyond these positions, **let the prose breathe.** Use the Main Entity when it reads naturally. Use synonyms, semantic variations, and related phrasing everywhere else. The standard is: *Would a human expert writing about this topic for a knowledgeable audience use this word here?* If yes, include it. If the sentence exists only to insert a keyword, delete it.

### Keyword Governance

- Each article targets ONE Main Entity cluster from the BWC Content Map. No two articles compete for the same Main Entity — this is keyword cannibalization and it dilutes authority across the site.  
- **Hub articles** target broad entities ("Bhutan wine," "emerging wine regions").  
- **Spoke articles** target specific facets ("highest elevation vineyards world," "Traminette grape Himalayas").  
- Every spoke references its parent hub's Main Entity at least once to reinforce the topical cluster relationship.

---

## 5\. E-E-A-T Compliance

Every article must demonstrate all four signals. In the 2026 search landscape — where AI systems evaluate trustworthiness before citing sources — E-E-A-T is not a ranking factor. It is a prerequisite for visibility.

### Experience

- Include first-person observations that could only come from physical presence: the sound of the Punatshang River below the Pinsa vineyard, the weight of monsoon air during an eastern harvest, the texture of laterite soil at Bajo.  
- Reference specific moments: planting days, harvest decisions, weather events, winemaking pivots.  
- Use phrases rooted in lived reality: "Walking the rows at Yusipang in late September, you can feel the temperature drop as the sun dips behind the ridge..."  
- **Mandate original photography over stock imagery.** Experience is demonstrated visually as much as textually. (See Section 8: Visual-to-Text Bridge.)

### Expertise

- Every article carries an **author byline with credentials.** The byline is not decorative — it is an E-E-A-T signal that search engines and AI systems actively evaluate.  
- Author bio appears at article foot: name, title, relevant credentials (MW candidate, WSET Diploma, viticulture degree, years in industry), and a link to a professional profile.  
- Cite specific data pulled from the Knowledge Base: elevation, soil composition, ABV, harvest dates, yield figures. Vague claims ("high altitude," "unique terroir") without supporting numbers fail the expertise test.  
- Use correct technical terminology — veraison, phenolic ripeness, diurnal temperature variation, malolactic fermentation — then briefly explain for a general audience on first use.

### Authoritativeness

- Link to third-party coverage from editorially trusted sources (see Section 7: Editorial Trust Hierarchy).  
- Reference the Bonhams auction and its results as independent market validation.  
- Name advisory board members where editorially relevant — Jancis Robinson MW's involvement is the single strongest authority signal BWC possesses.  
- Cross-reference published industry data (OIV, VineExpo, IWSR) when making market-level claims.

### Trustworthiness

- Every article displays a publication date and a "Last Updated" date.  
- All factual claims are sourced — either inline or in a references section.  
- Contact information is accessible: link to `/contact-us` or `/general-6` (press).  
- **Never make unsubstantiated superlative claims.** Do not write "the best winery in Asia." Write content so thoroughly authoritative that third parties and AI systems reach that conclusion independently.

---

## 6\. Internal Linking Strategy

### Link Volume Requirements

| Article Type | Min Internal Links | Min Links to Core BWC Pages |
| :---- | :---- | :---- |
| Hub Article | 8–12 | 4–5 |
| Spoke Article | 5–8 | 3–4 |
| News / Update | 3–5 | 2–3 |

### Core Page Link Matrix

Every article must link to **at least 3** of the following core pages using natural, descriptive anchor text. Specific wines, vintages, and products referenced below use **category placeholders** — substitute the current offering from the Knowledge Base at time of writing.

| Tier | Page | URL | Trigger: Link When Content Mentions... | Anchor Text Pattern |
| :---- | :---- | :---- | :---- | :---- |
| **Tier 1 — Always Consider** | Grapes & Vineyards | `/the-grapes-vineyards` | Vineyard names, grape varieties, terroir, altitude, organic farming | "our vineyards spanning \[ELEVATION RANGE\]," "where we grow \[VARIETY\]" |
| **Tier 1** | Our Wine | `/our-wine` | Ser Kem brand, any wine by name, tasting notes, vintages | "explore \[CURRENT VINTAGE\] Ser Kem wines," "our \[TARGET CURRENT WHITE FLAGSHIP\]" |
| **Tier 1** | Visit Us | `/visit-us` | Visiting Bhutan, winery tours, tastings, travel planning | "visit us in Bhutan," "wine experiences in the Kingdom" |
| **Tier 1** | About Us | `/about-us` | Bhutan as a country, carbon-negative, GNH, mission, founders | "the Kingdom's story," "Bhutan's carbon-negative commitment" |
| **Tier 2 — Contextual** | First Barrel | `/our-wine-2023-first-barrel` | Historic first harvest, Bonhams auction, inaugural vintage | "the historic First Barrel," "our inaugural vintage" |
| **Tier 2** | Allocation Request | `/2024-inquiry-request` | Purchasing wine, requesting allocation, limited availability | "request an allocation of \[TARGET CURRENT FLAGSHIP\]" |
| **Tier 2** | First Release | `/first-release` | Historic significance, new wine country, registration | "the birth of a new wine nation," "register for future releases" |
| **Tier 3 — Opportunistic** | Merch | `/category/all-products` | Brand lifestyle, gifts, merchandise | "explore BWC collection" |
| **Tier 3** | Contact | `/contact-us` | General inquiries | "get in touch" |
| **Tier 3** | Press | `/general-6` | Media, journalist inquiry | "press inquiries" |

### Hub-Spoke Cross-Linking Protocol

1. **Every spoke MUST link to its parent hub.** Use language related to the hub's Main Entity within the anchor text.  
2. **Every spoke SHOULD link to 1–2 sibling spokes** within the same cluster — this creates the topical mesh that signals depth.  
3. **Every spoke SHOULD link to 1 spoke in a DIFFERENT cluster** — this creates cross-cluster authority and prevents content silos.  
4. **Hub articles MUST link to ALL their published spokes.** When a new spoke goes live, the hub is updated to include it.  
5. **Post-publish backfill is mandatory.** Within 24 hours of publishing any new article, add a contextual link TO the new article from 2–3 existing related posts. This is the step most teams skip. Do not skip it.

### Anchor Text Governance

- **Prohibited:** "click here," "read more," "learn more," "this article," or any non-descriptive anchor.  
- Anchor text must be 3–8 words and contextually relevant to the destination page.  
- Vary anchor text across articles linking to the same page. Repetitive exact-match anchors trigger over-optimization signals.  
- Bold or visually emphasize the first internal link in the article body to increase engagement.

---

## 7\. External Linking Strategy

### Volume Requirements

| Article Type | Min Outbound Links |
| :---- | :---- |
| Hub Article | 5–8 |
| Spoke Article | 3–5 |
| News / Update | 2–3 |

### Editorial Trust Hierarchy

External links are selected based on **editorial trustworthiness and source proximity to the truth,** not third-party domain authority scores. DA is a proprietary metric from SEO tool vendors — Google does not use it, and over-indexing on it leads to linking patterns that prioritize popular aggregators over primary sources. BWC content links to the most trustworthy source available, evaluated in the following order of priority:

**1st Priority — Primary Sources**

The original point of data or decision. Link here whenever a primary source exists.

| Type | Examples |
| :---- | :---- |
| Government & Institutional | Royal Government of Bhutan publications, OIV (oiv.int) global viticulture data, USDA soil surveys, Bhutan National Statistics Bureau |
| Academic & Scientific | Peer-reviewed viticulture research, university extension publications (UC Davis, Lincoln University NZ), published terroir studies |
| Original BWC Data | Knowledge Base metrics cited transparently — BWC is a primary source on its own operations |
| Auction & Transaction Records | Bonhams (bonhams.com) sale results, verified provenance documentation |

**2nd Priority — Established Global Authorities**

Credible publications with editorial standards, fact-checking processes, and recognized expertise in wine or travel. Link here when a primary source is unavailable or when the editorial analysis itself adds value.

| Source | Domain | Link When Discussing... |
| :---- | :---- | :---- |
| Jancis Robinson | jancisrobinson.com | Bhutan wine reviews, critic endorsement, advisory board |
| Wine Enthusiast | wineenthusiast.com | Bhutan wine coverage, Ser Kem auction, industry trends |
| Decanter | decanter.com | Origin story, emerging regions, critical reception |
| World of Fine Wine | worldoffinewine.com | Terroir analysis, winemaking philosophy |
| The Drinks Business | thedrinksbusiness.com | Industry news, market positioning |
| SevenFifty Daily | daily.sevenfifty.com | Trade trends, on-premise insights |
| Wikipedia | en.wikipedia.org | Bhutanese wine article, grape variety reference, Bhutan country data |

**3rd Priority — Niche Experts & Specialist Voices**

Smaller publications, independent critics, and subject-matter specialists who bring deep expertise on a narrow topic. Valuable for long-tail and technical content.

| Source | Domain | Link When Discussing... |
| :---- | :---- | :---- |
| Wine Scholar Guild | winescholarguild.com | Educational terroir deep dives, certification study |
| Sommeliers Choice Awards | sommelierschoiceawards.com | Emerging regions, sommelier perspective |
| Wine-Searcher | wine-searcher.com | Market pricing context, availability data |
| GuildSomm | guildsomm.com | Professional sommelier community, education |
| BWC Instagram | instagram.com/bhutanwine | Social proof, visual storytelling, community engagement |

### Source Selection Principles

- **Prefer the source closest to the original fact.** If OIV published the statistic, link to OIV — not to a Wine Enthusiast article that cites OIV.  
- **Never link to a source solely because it is well-known.** The link must add genuine value for the reader at the point in the text where it appears.  
- **Recency matters for data, not for analysis.** A 2024 OIV statistical report is preferred over a 2026 blog post that summarizes it. A 2020 Jancis Robinson essay on terroir philosophy may be more valuable than a 2026 listicle.  
- **Do NOT link to competitor wine e-commerce pages.**  
- **Distribute external links evenly** through the article body — never cluster them in a single section.

### External Link Technical Rules

- All external links open in a new tab (`target="_blank"`)  
- Use `rel="noopener"` (Wix handles this automatically)  
- Do **NOT** apply `rel="nofollow"` to editorial links — passing authority to credible sources signals trust  
- When linking to paywalled content (Jancis Robinson, Financial Times), note that the source may require a subscription — this is a courtesy to the reader

---

## 8\. Image Optimization & Visual-to-Text Bridge

### Image Volume Requirements

| Article Type | Min Images | Max Images |
| :---- | :---- | :---- |
| Hub Article | 5–8 | 12 |
| Spoke Article | 3–5 | 8 |
| News / Update | 1–3 | 5 |

### Placement Protocol

1. **Hero image** immediately following the Executive Summary Block, before the first body paragraph.  
2. **At least one image per H2 section** in hub articles.  
3. **No more than 400 consecutive words** without a visual element (image, infographic, pull-quote with visual styling, or embedded map).

### Alt Text & Accessibility — The Correct Standard

Alt text exists to serve visually impaired users. It is an accessibility requirement first and a search signal second. BWC content follows WCAG 2.2 AA guidelines:

**Informative images** — photographs, charts, infographics, or any image that conveys content the reader needs — receive **descriptive alt text that explains what the image shows** to someone who cannot see it.

- Write a natural sentence of 10–25 words  
- Describe **what is in the image,** not what you want it to mean  
- Include relevant context (location, activity, subject) that helps a screen-reader user understand the image's relationship to the surrounding text  
- The main topic may appear in alt text **only when it genuinely describes the image content.** A photo of Merlot vines at Bajo naturally includes "Merlot vines at Bajo vineyard" — that is description, not optimization. A photo of a sunset over the valley does not need a grape variety forced into its alt text.

**Decorative images** — mood shots, background textures, visual flourishes, section dividers, or purely atmospheric photography that does not convey informational content — must use an **empty alt attribute: `alt=""`**. This tells screen readers to skip the image entirely rather than announcing a meaningless or misleading description. Apply `role="presentation"` when possible.

**Examples:**

| Image | Classification | Alt Text |
| :---- | :---- | :---- |
| Merlot clusters on the vine at harvest | Informative | `alt="Ripe Merlot grape clusters on VSP-trained vines at the Bajo vineyard in Bhutan's Punakha Valley during the autumn harvest"` |
| Winemaker examining a barrel sample | Informative | `alt="BWC winemaker drawing a barrel sample of red wine in the Thimphu production facility"` |
| Misty mountain panorama used as section break | Decorative | `alt=""` |
| Abstract close-up of wine glass condensation | Decorative | `alt=""` |
| Elevation diagram showing all vineyard sites | Informative | `alt="Diagram showing Bhutan Wine Company's eight vineyard sites by elevation, from Bajo at the lowest point to Ser Bhum at the highest"` |

### Additional Image Technical Requirements

| Element | Specification |
| :---- | :---- |
| **Filename** | Descriptive, hyphenated. Example: `bajo-vineyard-merlot-harvest-punakha.jpg` |
| **Title attribute** | Short human-readable label. Example: `Bajo Vineyard Merlot Harvest` |
| **File size** | Under 200KB. Compress via TinyPNG or Squoosh before upload. |
| **Format** | WebP preferred. JPEG acceptable. PNG only for graphics, logos, or infographics. |
| **Dimensions** | Hero: minimum 1200px wide. Inline: minimum 800px wide. |
| **Caption** | Required on informative images depicting a specific location, person, process, or moment. Captions receive 300% more reader attention than body text. |

### The Visual-to-Text Bridge — MANDATORY

In 2026, AI systems evaluate the **semantic relationship between images and surrounding prose** to assess the "Experience" signal in E-E-A-T. An article with photos that are never referenced in the text reads as stock imagery — even if the photos are original. An article that describes what is happening in its photos reads as firsthand documentation.

**The rule:** Every **informative** image in the article must be **narratively described in the adjacent body text.** The reader (and the AI crawler) should encounter the image and the prose as a unified experience, not as separate elements. Decorative images are exempt from this requirement.

**How to execute:**

Within 1–2 paragraphs of every informative image, the body text must describe or reference what is depicted. This is not the alt text or the caption — it is woven into the prose itself.

**Example — CORRECT:**

*\[Image: Vineyard rows with Himalayan peaks in background\]*

The Bajo vineyard occupies a flat stretch of the Punakha Valley where the Pho Chhu and Mo Chhu rivers converge. In the photograph above, you can see the VSP trellises running in precise rows against the backdrop of the Lesser Himalayas — a juxtaposition that captures the ambition of growing Bordeaux varieties at the foot of the world's highest mountain range. The laterite soil here, visible as a deep rust-red between the rows, gives the Merlot a mineral backbone that our winemaker describes as unlike anything in his California experience.

**Example — INCORRECT:**

*\[Image: Vineyard rows with Himalayan peaks in background\]*

Bhutan Wine Company grows many grape varieties. The terroir is unique and produces exceptional wines.

*(The text has no relationship to the image. An AI system reading this cannot confirm the author has firsthand experience of the vineyard depicted.)*

**Visual-to-Text Bridge Checklist:**

- [ ] Every **informative** image is described or referenced in adjacent body text (within 1–2 paragraphs)  
- [ ] Descriptions include specific, observable details visible in the image (soil color, trellis type, weather conditions, human activity)  
- [ ] At least one image per article includes a sensory observation beyond the visual (sound, temperature, smell, texture) — this signals physical presence  
- [ ] Decorative images are not awkwardly described in body text — they are allowed to exist as atmosphere  
- [ ] No informative image is orphaned as pure decoration without textual connection

### Preferred Image Subjects (priority order)

1. Original vineyard photography — seasonal, showing terroir, weather, crew at work  
2. Winemaking process — harvest, crush, barrel work, bottling, the winery interior  
3. Wine bottles in Bhutan landscape context — not studio product shots  
4. Bhutanese cultural moments — dzongs, festivals, farming traditions, prayer flags  
5. Team and founders in working settings — vineyard or winery, not posed portraits  
6. Maps, elevation diagrams, or infographics — vineyard locations, climatic zone illustrations  
7. Food and wine pairing imagery — Bhutanese cuisine with Ser Kem wines

---

## 9\. Schema Markup & Structured Data

### Required Schema per Article Type

| Content Type | Schema Required |
| :---- | :---- |
| All blog posts | `BlogPosting` with: headline, datePublished, dateModified, author (with credentials), image, publisher |
| Posts with FAQ section (when included) | `FAQPage` wrapping all Q\&A pairs |
| Wine reviews / tasting notes | `Review` with itemReviewed |
| How-to or process content | `HowTo` with named steps |
| Posts referencing BWC visits | `LocalBusiness` reference |
| **Single-wine focused posts ONLY** | `Product` with name, priceCurrency, availability (from Knowledge Base) |

### Product Schema — Restricted Application

`Product` schema is applied **only** to articles where a single wine is the primary editorial focus — for example, a dedicated tasting note profile, a vintage deep dive, or an allocation announcement for one specific wine. It is **never** applied to listicles, roundups, general blog posts that mention multiple wines in passing, or hub articles that survey the portfolio. Misapplying Product schema to pages that are not genuinely about a single purchasable product degrades schema trust signals and risks structured data penalties.

### FAQ Section — Intent-Based, Not Mandatory

The FAQ section is a powerful tool when it matches the search intent of the article. It is **not required on every post.** Include an FAQ section when:

- The article targets an **informational or question-heavy query** (e.g., "How is wine grown in Bhutan?" / "What is high-altitude viticulture?")  
- There is a clear **"People Also Ask" opportunity** — verified by checking Google's PAA box for the target Main Entity  
- The article is a **hub or pillar page** serving as a comprehensive resource

**Do NOT include an FAQ section when:**

- The article is primarily **narrative or experiential** (e.g., a vineyard journal entry, a harvest story, a brand origin piece) — forcing Q\&A structure onto a narrative breaks the reading experience  
- The article is a **news update or announcement** — these are declarative by nature  
- There are no genuine, high-value questions to answer — a FAQ section with weak or obvious questions hurts more than it helps

**When included, FAQ format must be:**

```
## Frequently Asked Questions

### [Question phrased as someone would naturally type or speak it]?

[Direct answer — first sentence is a complete standalone response.
Second sentence adds one supporting detail. Third sentence optional.
Total: 2–3 sentences maximum per answer.]
```

When an FAQ section is included, wrap it in `FAQPage` schema. When it is omitted, do not include `FAQPage` schema. Target 3–5 Q\&A pairs when present.

---

## 10\. Content Quality Standards

### Voice & Tone

The BWC voice is **luxury, authoritative, and visionary.**

- Write as if narrating the founding of a wine region that will be studied for generations. Not breathlessly. Not with false modesty. With the quiet confidence of someone who knows the significance of what they are building.  
- **First-person plural** ("we," "our") when discussing BWC operations, winemaking decisions, or vineyard observations.  
- **Third-person** when discussing the broader wine industry, Bhutan as a country, or external research.  
- **Never use exclamation points** in body text. Enthusiasm is conveyed through specificity, not punctuation.  
- **Never use filler phrases:** "In this article, we will explore..." / "It's worth noting that..." / "As you may know..." — begin every section with substance.

### Prose Standards

- **Paragraphs:** 2–4 sentences maximum. Readers scan. Respect that.  
- **Sentences:** Vary length deliberately. Alternate short declaratives with longer constructions. Target average sentence length of 15–20 words.  
- **Technical terms:** Use them. Then explain them. The reader is intelligent and curious but not necessarily a wine professional. First mention of a term like "veraison" should be followed by a brief parenthetical or subordinate clause defining it.  
- **Readability:** Target Flesch-Kincaid Grade Level 8–10. Accessible to a broad audience while maintaining intellectual credibility.  
- **Pull-quotes / callout boxes:** Include one per 500 words in hub articles. These break visual monotony and provide additional scannable entry points.

### Originality Requirements

- **Minimum 70% original content:** Proprietary data, firsthand observations, Knowledge Base material, original analysis.  
- **Maximum 30% industry context:** External sources cited to frame the BWC story within global trends.  
- **Every article must contain at least one data point that exists nowhere else on the internet.** A specific harvest date. A yield measurement. A winemaker's unpublished observation. An elevation reading from a GPS survey. This is the content moat.  
- **Never reproduce copy from existing bhutanwine.com pages.** Reference and link — do not duplicate.

---

## 11\. AI Citability & Snippet Management

### Citable Paragraph Architecture

Every article must contain **3–5 "citable paragraphs"** — self-contained, factually dense statements of 2–3 sentences that can be extracted by an AI system and used as a complete answer without surrounding context.

These are distinct from the Executive Summary Block (which opens the article). Citable paragraphs are distributed throughout the body, typically as the opening statement of each H2 section.

**Characteristics of a strong citable paragraph:**

- Begins with a declarative fact, not a question or narrative setup  
- Contains at least one specific number, date, or proper noun  
- Could serve as a standalone response to a search query  
- Does not rely on pronouns that reference preceding text ("This," "It," "They" without antecedent)

**Example:**

Bhutan Wine Company's Bajo vineyard in the Punakha Valley is the lowest-elevation site in the portfolio, where Merlot and Cabernet Sauvignon are trained on VSP trellises in laterite soil. The vineyard's position at the convergence of the Pho Chhu and Mo Chhu rivers creates a warm, dry microclimate that mirrors growing conditions found in parts of Bordeaux's Right Bank.

### Snippet Protection — `data-nosnippet`

Not all content should be freely extractable by AI systems or featured snippets. BWC may wish to protect certain content from being surfaced in AI summaries — particularly sensitive pricing, legal disclaimers, allocation terms, or proprietary commercial data.

For any content block that should be **excluded from Google Featured Snippets and AI Overviews,** wrap the HTML in a `data-nosnippet` attribute:

```html
<span data-nosnippet>
  2024 Ser Kem Pinot Noir: $500 per bottle. Allocation limited to 2 bottles
  per household. Subject to availability. Contact info@bhutanwine.com for
  current pricing.
</span>
```

**When to apply `data-nosnippet`:**

- Per-bottle pricing that may change between allocation cycles  
- Legal disclaimers, terms of sale, or liability language  
- Allocation restrictions or purchase limits  
- Any content where an out-of-context AI extraction could create customer confusion or legal exposure

**When NOT to apply it:**

- Editorial content, tasting notes, vineyard descriptions, or brand narrative — these should be maximally citable  
- FAQ answers — the purpose of FAQ structure is discoverability and extraction  
- The Executive Summary Block — this is designed to be extracted

**Implementation note for Wix:** `data-nosnippet` can be applied through the "Add HTML" embed widget in Wix's native blog editor. If using Velo (Wix's developer mode), apply it directly in the component code. The attribute is respected by Google; other AI systems (ChatGPT, Perplexity) may or may not honor it, but it remains the best available control mechanism.

### AI Citability Checklist

- [ ] Executive Summary Block present and compliant (25–40 words, bolded, reader-first)  
- [ ] 3–5 standalone citable paragraphs distributed across H2 sections  
- [ ] Each H2 section opens with a direct factual statement before expanding into narrative  
- [ ] Specific numbers, dates, and proper nouns are stated explicitly — never buried in subordinate clauses  
- [ ] FAQ answers (if FAQ section is included) are completely self-contained  
- [ ] Author and publication metadata is machine-readable via schema markup  
- [ ] `data-nosnippet` applied to any pricing, legal, or allocation content that should not be extracted

---

## 12\. Publishing Protocol

### Pre-Publish Verification

Run this checklist in full before any article goes live. Every item requires confirmation.

**Topical Authority & Entity Coverage**

- [ ] Main Entity clearly identified and comprehensively covered from multiple angles  
- [ ] 8–15 Supporting Entities naturally integrated throughout the article  
- [ ] Main Entity appears naturally in: H1, Executive Summary Block, meta title, meta description, URL slug, first 100 words, at least one H2, conclusion  
- [ ] No keyword cannibalization with existing published articles  
- [ ] Prose reads naturally to a human — no repetition a careful reader would notice

**Structure & Volume**

- [ ] Word count meets type target (Hub: 2,500+, Spoke: 1,200+, News: 600+)  
- [ ] Heading hierarchy clean: one H1 → H2s → H3s only under H2s  
- [ ] Executive Summary Block present, bolded, 25–40 words, reader-first  
- [ ] Author byline with credentials present  
- [ ] Publication date and "Last Updated" date visible

**Internal Links**

- [ ] Minimum count met (Hub: 8+, Spoke: 5+, News: 3+)  
- [ ] At least 3 links to BWC core pages per Tier 1/2/3 matrix  
- [ ] Link to parent hub (if spoke article)  
- [ ] Links to 1–2 sibling spokes in same cluster  
- [ ] Link to 1 spoke in a different cluster  
- [ ] Anchor text is descriptive, varied, and 3–8 words — no "click here"  
- [ ] All internal links tested and functional

**External Links**

- [ ] Minimum count met (Hub: 5+, Spoke: 3+, News: 2+)  
- [ ] Sources selected per Editorial Trust Hierarchy (Primary → Authorities → Niche)  
- [ ] External links open in new tab  
- [ ] No links to competitor e-commerce  
- [ ] Links distributed through body, not clustered  
- [ ] Paywalled sources noted with subscription courtesy where applicable

**Images, Accessibility & Visual-to-Text Bridge**

- [ ] Minimum image count met (Hub: 5+, Spoke: 3+, News: 1+)  
- [ ] Hero image has descriptive alt text and topic-relevant filename  
- [ ] All **informative** images have descriptive alt text (10–25 words, describes the image for visually impaired users)  
- [ ] All **decorative** images use `alt=""` and `role="presentation"` where possible  
- [ ] No image has a blank or missing alt attribute by accident — every image is deliberately classified as informative or decorative  
- [ ] All images compressed under 200KB  
- [ ] Captions on informative images depicting specific locations, people, or processes  
- [ ] No more than 400 consecutive words without a visual element  
- [ ] Every informative image is described in adjacent body text (Visual-to-Text Bridge)  
- [ ] At least one image includes a multi-sensory observation in accompanying text  
- [ ] Decorative images are not force-described in body text

**Schema & Structured Data**

- [ ] `BlogPosting` schema present with all required fields  
- [ ] `FAQPage` schema present **only if** FAQ section is included (intent-based decision)  
- [ ] `Product` schema applied **only if** article focuses on a single wine as primary subject  
- [ ] Additional schema applied where relevant (Review, HowTo, LocalBusiness)  
- [ ] Canonical URL set correctly  
- [ ] Mobile rendering verified — all content readable on phone screen  
- [ ] `data-nosnippet` applied to any pricing, legal disclaimers, or allocation terms

**Core Web Vitals & Page Performance**

- [ ] **Hero image is NOT lazy-loaded.** Apply `loading="eager"` and `fetchpriority="high"` to the hero `<img>` tag. All images below the fold use `loading="lazy"`.  
- [ ] **LCP (Largest Contentful Paint) target: under 2.5 seconds.** The hero image is almost always the LCP element on BWC blog posts. To meet this threshold: serve the hero in WebP format, size it to the rendered display dimensions (do not serve a 4000px image in a 1200px container), and ensure the image URL is discoverable in the initial HTML response — not injected by JavaScript after page load. In Wix, use the native image component rather than a custom HTML embed for the hero.  
- [ ] **CLS (Cumulative Layout Shift) target: under 0.1.** All images must have explicit `width` and `height` attributes (or CSS `aspect-ratio`) so the browser reserves space before the image loads. No visible content should shift after initial render.  
- [ ] **No render-blocking resources** in the critical path above the fold. Custom fonts, analytics scripts, and third-party embeds load asynchronously. (Wix handles most of this natively, but verify when adding custom code via Velo or HTML embeds.)  
- [ ] **Post-publish Lighthouse audit.** Run PageSpeed Insights on the live URL. All three Core Web Vitals (LCP, CLS, INP) must pass "Good" thresholds before the article is promoted or shared.

**AI Citability & Snippet Control**

- [ ] Executive Summary Block compliant and extraction-ready  
- [ ] 3–5 standalone citable paragraphs present  
- [ ] FAQ answers self-contained (if FAQ section included)  
- [ ] `data-nosnippet` correctly applied to all protected content  
- [ ] Volatile data sourced from Knowledge Base, not hardcoded

**Data Integrity**

- [ ] All pricing, availability, and vintage data verified against Knowledge Base  
- [ ] Vineyard metrics (elevation, hectares) confirmed current  
- [ ] Tasting notes match current vintage — no carryover from prior vintage without confirmation  
- [ ] Personnel titles and credentials verified

### Post-Publish Actions (within 24 hours)

- [ ] Submit URL to Google Search Console for indexing  
- [ ] **Backfill links:** Add a contextual link TO this article from 2–3 existing related posts  
- [ ] **Update parent hub:** If this is a spoke, add it to the hub's spoke link list  
- [ ] Share on Instagram (@bhutanwine) with link in bio or story  
- [ ] Verify all internal and external links functional on live page  
- [ ] Run PageSpeed Insights on the live URL — confirm all Core Web Vitals pass "Good"  
- [ ] Log article in the BWC Content Map tracker with publication date and URL

---

## 13\. Content Map Integration

All blog content follows the hub-and-spoke architecture defined in the BWC SEO Content Map. When producing a new article:

1. **Locate the article in the Content Map** — identify hub assignment, Main Entity, Supporting Entities, suggested external sources, and content brief.  
2. **Review the "Internal Links To" column** — these are the required internal link destinations for this specific article.  
3. **Identify sibling spokes** — find all other articles in the same hub cluster and plan cross-links.  
4. **Query the Knowledge Base** — pull current data for any volatile fields: pricing, availability, vintage stats, vineyard metrics, tasting notes.  
5. **Assess FAQ inclusion** — check Google PAA for the Main Entity. If question-heavy intent exists, include an FAQ section. If the article is primarily narrative or experiential, omit it.  
6. **Execute against this SOP** — every applicable section above governs the output. Compliance is verified through the Section 12 checklist before publication.

---

## Appendix A: Immutable Brand Constants

These facts are stable and do not require Knowledge Base verification before each article. They change only with major corporate events.

| Constant | Value |
| :---- | :---- |
| Company Name | Bhutan Wine Company |
| Wine Brand Name | Ser Kem (pronounced "Saire-Chem") |
| Ser Kem Meaning | "Offering of alcohol to the Gods" (Dzongkha) |
| Founding Event | First vines planted Spring 2019 at Yusipang |
| First Vine Planted | Merlot, April 2, 2019 |
| Location | Kingdom of Bhutan, Eastern Himalayas |
| Karp (Dzongkha) | "White" — used in Karp Reserve naming |
| Marp (Dzongkha) | "Red" — used in Marp Reserve naming |
| Bhutan Country Size | \~14,000 sq mi (smaller than Switzerland) |
| Carbon Status | World's only carbon-negative country |
| Organic Status | On track to be world's first completely organic country |
| Website | bhutanwine.com |
| Instagram | @bhutanwine |
| Email (experiences) | [experiences@bhutanwine.com](mailto:experiences@bhutanwine.com) |
| Email (general) | [info@bhutanwine.com](mailto:info@bhutanwine.com) |
| Bhutanese Toast Tradition | Dip ring finger in drink, flick droplets into air |

## Appendix B: Volatile Data — Always Query Knowledge Base

**Do NOT reference the following from memory or from this document. Always pull current values from the BWC Knowledge Base at time of writing.**

- Current vintage portfolio (wine names, number of wines, varietals)  
- Pricing per bottle and allocation status  
- ABV and technical wine data  
- Vineyard count, elevations, hectares under vine  
- Harvest dates and yield data  
- Winemaker tasting notes (per vintage)  
- Team members, titles, and credentials  
- Advisory board composition  
- Press coverage and awards (list evolves)  
- Tour/experience offerings and booking details  
- Merch catalog and pricing

---

*This SOP is the governing standard for all BWC content operations. It is designed to produce content that a world-class SEO strategist, a Master of Wine, and a luxury brand director would each recognize as best-in-class within their respective disciplines — not because it follows a formula, but because it reflects the same editorial judgment they would exercise themselves.*  
