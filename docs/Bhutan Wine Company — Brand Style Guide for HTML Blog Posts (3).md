# Bhutan Wine Company — Brand Style Guide for HTML Blog Posts

---

## 1\. What This Guide Does

This document governs the **visual system and front-end implementation standards** for Bhutan Wine Company blog posts.

It is **not** the master SEO strategy document. Use the SEO SOP for:

- keyword research  
- content briefs  
- entity coverage  
- schema decision-making  
- internal linking strategy  
- refresh cycles  
- post-publish measurement

This guide exists to ensure that the **presentation layer supports A+ SEO execution** instead of accidentally undermining it.

### Core Principle

Every blog post should be:

- visually on-brand  
- semantically structured  
- accessible  
- mobile-readable  
- crawlable  
- performant  
- easy to maintain in Wix or exported HTML

---

## 2\. Non-Negotiable Implementation Standards

These rules apply to every HTML blog post.

1. **Use real HTML for real content.** Headings, paragraphs, lists, captions, dates, and links must be visible in the DOM as standard HTML \- not embedded in images.  
2. **Use one `<h1>` per page.** The article title gets the only `<h1>`.  
3. **Do not use heading tags for styling only.** Use CSS classes to change appearance. Use `<h2>`, `<h3>`, and `<h4>` only when the content structure actually requires them.  
4. **Do not skip heading levels without reason.** The normal flow is `<h1>` \> `<h2>` \> `<h3>` \> `<h4>`.  
5. **Keep important copy indexable.** Do not hide essential text, sources, image context, or key answers inside carousels, tabs, hover-only states, or click-to-reveal interactions unless the content remains present and crawlable in the DOM.  
6. **Use standard crawlable links.** Internal and external links must use real `<a href="...">` elements.  
7. **Use valid `<head>` markup only.** Do not place invalid elements such as `<img>` or `<iframe>` inside `<head>`.  
8. **Use standard `<img>` elements for article images.** Do not rely on CSS background images for meaningful content images.  
9. **Favor readability over decorative styling.** The article should feel premium and literary, but never at the expense of clarity.  
10. **Preserve the same core meaning on mobile and desktop.** Do not remove essential copy, captions, links, or context on mobile.

---

## 3\. Color Palette

### Primary Colors

| Role | Hex | RGB | Usage |
| :---- | :---- | :---- | :---- |
| **Brand Gold** | `#bc9b5d` | `rgb(188, 155, 93)` | Brand name, section titles, accent borders, key headings, refined link accents |
| **Primary Text** | `#000000` | `rgb(0, 0, 0)` | Body text, headings, core article copy |
| **White** | `#ffffff` | `rgb(255, 255, 255)` | Page background, text on dark/image overlays |

### Secondary Text Colors

| Role | Hex | RGB | Usage |
| :---- | :---- | :---- | :---- |
| **Near-Black** | `#242323` | `rgb(36, 35, 35)` | Secondary heading text |
| **Dark Charcoal** | `#292929` | `rgb(41, 41, 41)` | Footer links, utility copy |
| **Medium Gray** | `#414141` | `rgb(65, 65, 65)` | Lead text, descriptive body text on light backgrounds |
| **Warm Brown** | `#624c40` | `rgb(98, 76, 64)` | Pull quotes, earthy accent text |

### Background Colors

| Role | Hex | RGB | Usage |
| :---- | :---- | :---- | :---- |
| **Warm Cream** | `#fcf8ed` | `rgb(252, 248, 237)` | Warm article sections, feature bands |
| **Warm Peach** | `#f6ebe4` | `rgb(246, 235, 228)` | Soft cards, inset feature areas |
| **Light Gray** | `#f7f7f7` | `rgb(247, 247, 247)` | Subtle section separation |
| **Soft Gray** | `#e8e6e6` | `rgb(232, 230, 230)` | Secondary panels |
| **Medium Gray** | `#c7c7c7` | `rgb(199, 199, 199)` | Subtle borders / utility accents |
| **Light Blue** | `#c8eef5` | `rgb(200, 238, 245)` | Informational boxes |
| **Deep Forest Green** | `#316142` | `rgb(49, 97, 66)` | Dark contextual sections, image overlays |

### Accent / Highlight Colors

| Role | Hex | Usage |
| :---- | :---- | :---- |
| **Hot Pink** | `#ed1566` | Experimental callout label only; use sparingly |
| **Nav Border** | `#cccccc` | Subtle border / divider treatment |

### CSS Variables

```css
:root {
  /* Primary */
  --bwc-gold: #bc9b5d;
  --bwc-black: #000000;
  --bwc-white: #ffffff;

  /* Text */
  --bwc-text-primary: #000000;
  --bwc-text-secondary: #414141;
  --bwc-text-dark-alt: #242323;
  --bwc-text-footer: #292929;
  --bwc-text-brown: #624c40;

  /* Backgrounds */
  --bwc-bg-cream: #fcf8ed;
  --bwc-bg-peach: #f6ebe4;
  --bwc-bg-light: #f7f7f7;
  --bwc-bg-soft-gray: #e8e6e6;
  --bwc-bg-blue: #c8eef5;
  --bwc-bg-green: #316142;

  /* Borders */
  --bwc-border-light: #cccccc;
}
```

---

## 4\. Typography

### Font Stack Overview

The site uses a layered serif-forward type system. Wix internal font names map to these Google Fonts equivalents for standalone HTML production:

| Wix Internal Name | Google Fonts Equivalent | Role |
| :---- | :---- | :---- |
| `wfont_db4df3_f64463dcdda3444582b829ae697afaaa` | **Custom uploaded font** (not publicly distributed) | Brand name, nav items |
| `fraunces` | **Fraunces** | Hero text, lead text, featured subheadings |
| `cormorantgaramond-semibold` | **Cormorant Garamond** `600` | Section titles, vineyard names, accent headings |
| `cormorantgaramond-light` | **Cormorant Garamond** `300` | Pull quotes, featured text |
| `avenir-lt-w01_35-light1475496` | **Nunito Sans** `300` | Primary body text |
| `avenir-lt-w01_85-heavy1475544` | **Nunito Sans** `700` | Bold body text, CTA labels |
| `caudex` | **Caudex** | Legacy fallback layer only |
| `trirong` | **Trirong** | Small utility / footer / figcaption use |

**Note on the custom brand font:** For blog posts outside the Wix font environment, use **Cormorant Garamond** at weight `500` with modest letter-spacing as the closest visual substitute.

### Google Fonts Import

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Nunito+Sans:wght@300;400;700&family=Trirong&display=swap" rel="stylesheet">
```

### Type Principles

1. **Serif-forward for hierarchy; sans-serif for body readability.**  
2. **Large expressive headings, restrained body copy.**  
3. **Elegant contrast without sacrificing legibility.**  
4. **No novelty typography inside article prose.**  
5. **Typography should create hierarchy before color does.**

---

## 5\. Typography Scale

### Brand Name / Logo Text

```css
.bwc-brand {
  font-family: 'Cormorant Garamond', serif;
  font-size: 36px;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: 0.36px;
  color: var(--bwc-gold);
}
```

### Navigation Items

```css
.bwc-nav {
  font-family: 'Cormorant Garamond', serif;
  font-size: 18px;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: 0.9px;
  color: var(--bwc-black);
}
```

### Hero Title

```css
.bwc-hero-title {
  font-family: 'Fraunces', serif;
  font-size: 42px;
  font-weight: 400;
  line-height: 1.1;
  color: var(--bwc-white);
}
```

### Hero Subtitle / Intro

```css
.bwc-hero-subtitle {
  font-family: 'Fraunces', serif;
  font-size: 21px;
  font-weight: 400;
  line-height: 1.35;
  color: var(--bwc-white);
}
```

### Section Title (Gold Accent)

```css
.bwc-section-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 55px;
  font-weight: 600;
  line-height: 1.05;
  color: var(--bwc-gold);
}
```

### Section Title (Standard)

```css
.bwc-section-title-standard {
  font-family: 'Cormorant Garamond', serif;
  font-size: 50px;
  font-weight: 500;
  line-height: 1.05;
  letter-spacing: 1.5px;
  color: var(--bwc-gold);
}
```

### Subsection Heading

```css
.bwc-subsection {
  font-family: 'Cormorant Garamond', serif;
  font-size: 28px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--bwc-text-primary);
}
```

### Card / Feature Heading

```css
.bwc-card-heading {
  font-family: 'Fraunces', serif;
  font-size: 40px;
  font-weight: 400;
  line-height: 1.1;
  color: var(--bwc-text-dark-alt);
}
```

### Featured / Pull Quote Text

```css
.bwc-featured-text {
  font-family: 'Cormorant Garamond', serif;
  font-size: 28px;
  font-weight: 300;
  line-height: 1.4;
  letter-spacing: 1.4px;
  color: var(--bwc-text-primary);
}
```

### Card Body / Descriptive Text

```css
.bwc-card-body {
  font-family: 'Fraunces', serif;
  font-size: 25px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--bwc-text-primary);
}
```

### Primary Body Text

```css
.bwc-body {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 16px;
  font-weight: 300;
  line-height: 1.6;
  color: var(--bwc-text-primary);
}
```

### Body Text Bold

```css
.bwc-body-bold {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.6;
  color: var(--bwc-text-primary);
}
```

### Footer / Small Text

```css
.bwc-footer {
  font-family: 'Trirong', serif;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--bwc-black);
}
```

### Footer Link / Press

```css
.bwc-footer-link {
  font-family: 'Cormorant Garamond', serif;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.6px;
  color: var(--bwc-text-footer);
}
```

---

## 6\. Blog Post Typography Mapping

Use semantic HTML first. Then apply the BWC look through CSS.

```css
/* === BLOG POST ELEMENT MAPPING === */

article h1 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 48px;
  font-weight: 600;
  line-height: 1.15;
  color: var(--bwc-gold);
  margin: 0 0 0.5em;
}

article h2 {
  font-family: 'Fraunces', serif;
  font-size: 36px;
  font-weight: 400;
  line-height: 1.2;
  color: var(--bwc-text-dark-alt);
  margin: 2em 0 0.75em;
}

article h3 {
  font-family: 'Cormorant Garamond', serif;
  font-size: 28px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--bwc-text-primary);
  margin: 1.5em 0 0.5em;
}

article h4 {
  font-family: 'Fraunces', serif;
  font-size: 22px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--bwc-text-secondary);
  margin: 1.25em 0 0.5em;
}

article p,
article li {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 16px;
  font-weight: 300;
  line-height: 1.7;
  color: var(--bwc-text-primary);
}

article p {
  margin: 0 0 1.25em;
}

article ul,
article ol {
  margin: 0 0 1.5em 1.25em;
  padding: 0;
}

article li + li {
  margin-top: 0.45em;
}

article blockquote {
  font-family: 'Cormorant Garamond', serif;
  font-size: 24px;
  font-weight: 300;
  line-height: 1.5;
  letter-spacing: 0.5px;
  color: var(--bwc-text-brown);
  border-left: 3px solid var(--bwc-gold);
  padding-left: 1.25em;
  margin: 2em 0;
  font-style: italic;
}

article a {
  color: var(--bwc-gold);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.14em;
  transition: opacity 0.2s ease;
}

article a:hover,
article a:focus-visible {
  opacity: 0.85;
}

article figure {
  margin: 2em 0;
}

article img {
  display: block;
  width: 100%;
  height: auto;
}

article figcaption {
  font-family: 'Trirong', serif;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.45;
  color: var(--bwc-text-secondary);
  margin-top: 0.5em;
}

article .lead,
article .intro {
  font-family: 'Fraunces', serif;
  font-size: 21px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--bwc-text-secondary);
  margin-bottom: 2em;
}

article .meta,
article .eyebrow,
article .last-updated {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--bwc-text-secondary);
}
```

### Semantic Usage Rules

- `<h1>` \= article title only  
- `<h2>` \= major section  
- `<h3>` \= subsection within an `<h2>`  
- `<h4>` \= minor subdivision only if genuinely useful  
- `<p>` \= standard prose  
- `<ul>` / `<ol>` \= lists, takeaways, process steps  
- `<blockquote>` \= quotations or highlighted observations  
- `<figure>` \+ `<figcaption>` \= media with contextual caption  
- `<time>` \= publication or updated date  
- `<address>` \= contact info only, not for general styling

---

## 7\. Layout & Spacing Patterns

### Content Width

- **Max article content width:** `980px`  
- **Readable prose width target:** `680px` to `760px` where possible for long-form text blocks  
- **Centered layout** with auto margins  
- **Generous vertical spacing** between sections

### Spacing Scale

```css
:root {
  --space-xs: 8px;
  --space-sm: 16px;
  --space-md: 24px;
  --space-lg: 48px;
  --space-xl: 80px;
  --space-2xl: 120px;
}
```

### Section Pattern

- Alternate white and warm-tinted backgrounds with restraint  
- Use dark sections only when the imagery or content justifies them  
- Prefer whitespace, type, and image rhythm over ornamental separators  
- Do not break article reading flow with excessive cards or stacked callouts

### Readability Rules

- Avoid overly wide body text lines  
- Avoid dense wall-of-text paragraphs  
- Maintain generous paragraph spacing  
- Do not center long body copy  
- Use left-aligned body text for readability

---

## 8\. Design Principles

1. **Serif-dominant elegance**  
2. **Gold as restrained accent, not a blanket styling color**  
3. **Warm, natural, quiet luxury tone**  
4. **Imagery carries atmosphere; typography carries hierarchy**  
5. **Minimal UI chrome**  
6. **Generous white space**  
7. **Structure should feel editorial, not salesy**  
8. **Beauty must remain compatible with clarity, accessibility, and crawlability**

---

## 9\. Accessibility and SEO-Safe Design Rules

This section is mandatory for all blog templates and post builds.

### Headings and Structure

- Use a single visible `<h1>`  
- Keep heading order logical  
- Do not create fake headings with `<div>` or `<p>` when the content is structurally a heading  
- Do not use all-caps body paragraphs for decorative effect  
- Use lists for lists, not a sequence of styled paragraphs

### Text Legibility

- Maintain sufficient contrast between text and background  
- Avoid light gray body text on tinted backgrounds unless thoroughly readable  
- Do not place long text directly over images without a proper overlay  
- Ensure linked text is visually identifiable without hover

### Interaction States

- Links and interactive controls must have visible hover and focus states  
- Focus styles may be refined to fit the brand, but may not be removed  
- Avoid hover-only disclosure of essential information

### Decorative Content

- Decorative separators should not interrupt reading order  
- Decorative icons should be hidden from assistive tech when appropriate  
- Do not use decorative images to carry factual information

---

## 10\. Image Standards

Images are central to the BWC brand. They must also be implementation-safe.

### Image Principles

1. Prefer **original photography** whenever available  
2. Use images to reinforce firsthand knowledge, place, terroir, craft, and atmosphere  
3. Keep images editorial and documentary in feel, not stock-heavy or over-staged  
4. Pair images with surrounding text that gives them narrative context

### Image Treatment

- Full-width hero images are appropriate  
- Inline images should usually sit within the main content width  
- Avoid heavy borders and shadows  
- Preserve clean edges and natural color  
- Do not use text baked into images for key messages

### Allowed Image Uses

- vineyard photography  
- harvest and cellar work  
- bottles in landscape context  
- maps and diagrams  
- archival or documentary material  
- cultural or travel context, where editorially relevant

### Avoid

- generic stock imagery with no connection to Bhutan or BWC  
- text-heavy graphics in place of real prose  
- slideshow galleries that hide important visuals from the article flow  
- background-image-only implementations for meaningful content images

---

## 11\. Image Accessibility and Discoverability

### Required HTML Pattern

Use real `<img>` elements inside `<figure>` when the image is meaningful.

```html
<figure>
  <img
    src="/images/bajo-vineyard-merlot-harvest-1600.jpg"
    srcset="/images/bajo-vineyard-merlot-harvest-800.jpg 800w,
            /images/bajo-vineyard-merlot-harvest-1200.jpg 1200w,
            /images/bajo-vineyard-merlot-harvest-1600.jpg 1600w"
    sizes="(max-width: 800px) 100vw, 760px"
    alt="Merlot rows in the Bajo vineyard during late-season ripening in Punakha Valley">
  <figcaption>The Bajo vineyard in Punakha Valley during late-season ripening.</figcaption>
</figure>
```

### Alt Text Rules

- Write alt text for **informative** images  
- Use `alt=""` for **purely decorative** images  
- Describe what is actually shown  
- Keep alt text concise, concrete, and human-readable  
- Do not force keywords into alt text  
- Do not repeat the full caption word-for-word unless necessary  
- If the image is already fully explained by adjacent prose and is decorative in function, empty alt is allowed

### Captions

Use captions when they add:

- location context  
- credit  
- date  
- identification  
- observational detail  
- interpretive value

Do not add captions just to fill space.

### Filenames

Use descriptive, hyphenated filenames:

- `bhutan-bajo-vineyard-merlot-ripening.jpg`  
- `ser-kem-first-release-bottle-paro.jpg`

Avoid:

- `IMG_4432.jpg`  
- `hero-final-final2.jpg`

### Responsive Image Rules

- Provide a fallback `src`  
- Use `srcset` / `sizes` where possible  
- Keep the image discoverable in rendered HTML  
- Do not lazy-load images in a way that prevents them from loading when they enter the viewport

### Hero Image Rule

If the hero image is above the fold and visually essential, do **not** defer it unnecessarily. Prioritize stable, fast rendering.

---

## 12\. The Visual-to-Text Bridge

For article images, the prose should acknowledge what the reader sees.

This is both a quality principle and a trust principle.

### Required Practice

Within 1-2 paragraphs of a meaningful image:

- reference what is shown, when relevant  
- connect the image to the article's subject  
- add a factual or observational detail that gives the image editorial purpose

### Good Example

The rows shown above in Bajo run across a flatter, warmer valley floor than most readers expect from Himalayan viticulture. That contrast \- alpine context above, heat accumulation below \- is part of what makes the site viable for Merlot.

### Bad Example

Bhutan Wine Company grows exceptional grapes in unique conditions.

The second sentence could accompany any image and adds no real context.

---

## 13\. Mobile Readability Standards

All article templates must be tested on mobile first.

### Minimum Mobile Standards

- body text should remain comfortably readable without zoom  
- line-height must stay generous on small screens  
- heading wraps must feel intentional, not crushed  
- images must scale cleanly  
- captions must remain legible  
- tap targets must be usable  
- core article content must be the same in meaning on mobile and desktop

### Mobile Type Guidance

```css
@media (max-width: 768px) {
  article h1 {
    font-size: 38px;
    line-height: 1.15;
  }

  article h2 {
    font-size: 30px;
    line-height: 1.2;
  }

  article h3 {
    font-size: 24px;
    line-height: 1.3;
  }

  article p,
  article li {
    font-size: 16px;
    line-height: 1.7;
  }

  article .lead,
  article .intro {
    font-size: 19px;
    line-height: 1.5;
  }
}
```

### Mobile Layout Rules

- avoid side-by-side body-copy columns  
- stack media and text cleanly  
- avoid giant empty spacer bands  
- avoid sticky overlays that cover content  
- avoid carousels for essential article content

---

## 14\. Link Standards

Links should feel elegant, but they must still look like links.

### Link Rules

- Body links must be visually distinct from surrounding text  
- Do not rely on color alone if the contrast is subtle  
- Underline body links by default  
- Decorative button styles are fine for CTAs, but informational links in body copy should remain recognizable  
- Internal links should not be hidden in vague phrases like "read more"

### Recommended Link CSS

```css
article a {
  color: var(--bwc-gold);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.14em;
}

article a:hover,
article a:focus-visible {
  opacity: 0.85;
}
```

### CTA Distinction

Use buttons or CTA cards sparingly and only when the article genuinely benefits from a next step such as:

- visit the winery  
- explore wines  
- request an allocation  
- contact BWC

Do not turn the article body into a stack of CTAs.

---

## 15\. Metadata and Head Markup Rules

The design system must not break metadata.

### Required `<head>` Elements

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>[Article Title] - Bhutan Wine Company</title>
<meta name="description" content="[Compelling summary of the page]">
<link rel="canonical" href="https://bhutanwine.com/[slug]">
```

### Rules

- `<head>` may contain only valid head elements  
- keep `<title>`, meta description, canonical, stylesheet links, and scripts in valid order  
- do not place images, embeds, or random HTML in `<head>`  
- do not duplicate canonical tags  
- if a robots tag is used, it must be intentional and documented

### Optional Snippet Control Layer

Use only when directed by the SEO SOP or publishing owner:

- `max-snippet`  
- `nosnippet`  
- `data-nosnippet`

These are not style decisions; they are implementation controls and must be used intentionally.

---

## 16\. Performance-Aware Design Rules

The BWC site should feel luxurious, but not slow.

### Required Practices

- compress images appropriately before upload  
- prefer modern formats where supported  
- do not load oversized images for small containers  
- limit unnecessary font variations  
- avoid animation that delays reading  
- avoid layout shift caused by media with no reserved dimensions  
- provide width and height attributes where practical  
- do not overload pages with decorative scripts

### Use Restraint With

- parallax effects  
- autoplay media  
- background videos  
- large webfont stacks  
- excessive above-the-fold imagery

### Performance Philosophy

A premium site should feel calm and immediate, not heavy.

---

## 17\. Recommended Editorial Components

These patterns are approved because they support both readability and structured understanding.

### Lead Summary

A short opening paragraph beneath the title that frames the article clearly.

### Key Facts Box

Use for:

- vineyard altitude  
- vintage dates  
- geography  
- grape varieties  
- auction facts  
- quick comparisons

### Comparison Table

Useful for:

- vineyards  
- elevations  
- varieties  
- travel distinctions  
- vintage differences

### Pull Quote

Use sparingly for:

- a founder line  
- a winemaking observation  
- a vivid sensory insight  
- a quote from external coverage

### Figure With Caption

Best for:

- vineyard photography  
- cellar process photos  
- maps  
- historical images  
- bottle context shots

### Source / Notes Block

Useful when the piece cites:

- press coverage  
- technical references  
- auction data  
- travel or country facts

---

## 18\. Blog Post HTML Template Skeleton

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Blog Title] - Bhutan Wine Company</title>
  <meta name="description" content="[Compelling page summary]">
  <link rel="canonical" href="https://bhutanwine.com/[slug]">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Nunito+Sans:wght@300;400;700&family=Trirong&display=swap" rel="stylesheet">

  <style>
    /* Paste CSS variables, typography mapping, layout rules, and responsive styles here */
  </style>
</head>
<body>
  <article class="bwc-article">
    <header class="blog-hero">
      <p class="eyebrow">Bhutan Wine Company Journal</p>
      <h1>[Blog Post Title]</h1>
      <p class="lead">[Opening deck / summary paragraph]</p>
      <p class="meta">
        <time datetime="2026-02-28">February 28, 2026</time>
        <span aria-hidden="true"> - </span>
        <span>By [Author Name]</span>
      </p>
    </header>

    <section class="blog-content">
      <p>Body text goes here...</p>

      <h2>Section Heading</h2>
      <p>More body text...</p>

      <figure>
        <img
          src="/images/example-1600.jpg"
          srcset="/images/example-800.jpg 800w, /images/example-1200.jpg 1200w, /images/example-1600.jpg 1600w"
          sizes="(max-width: 800px) 100vw, 760px"
          alt="Description of the image">
        <figcaption>Image caption text.</figcaption>
      </figure>

      <h3>Subsection Heading</h3>
      <p>More detail...</p>

      <blockquote>
        A pull quote or key observation.
      </blockquote>

      <h2>Key Facts</h2>
      <ul>
        <li>Fact one</li>
        <li>Fact two</li>
        <li>Fact three</li>
      </ul>
    </section>

    <footer class="article-footer">
      <p class="last-updated">Last updated: <time datetime="2026-02-28">February 28, 2026</time></p>
    </footer>
  </article>
</body>
</html>
```

---

## 19\. Component Do / Do Not Rules

### Do

- keep article structure simple and semantic  
- use image captions when they help  
- support tables, lists, and source sections where helpful  
- keep body copy readable  
- preserve the editorial feel of the brand  
- use whitespace generously  
- style informative content elements cleanly

### Do Not

- replace headings with styled paragraphs  
- hide key content in tabs or sliders  
- use gold text everywhere  
- force centered body text  
- use decorative scripts that delay rendering  
- rely on images for text content  
- use hover as the only way to reveal meaning  
- turn every article into a landing page

---

## 20\. Production QA Checklist

Before publishing any blog post or updating a blog template, confirm all of the following.

### Semantics

- [ ] One visible `<h1>` only  
- [ ] Heading order is logical  
- [ ] Lists use `<ul>` / `<ol>`  
- [ ] Important copy is visible in HTML text  
- [ ] Links use real `<a href="">` elements

### Accessibility

- [ ] Text is readable against its background  
- [ ] Body links are identifiable  
- [ ] Focus states remain visible  
- [ ] Informative images have useful alt text  
- [ ] Decorative images use empty alt text where appropriate  
- [ ] Captions are readable on mobile

### Image Implementation

- [ ] Meaningful images use `<img>`  
- [ ] Filenames are descriptive  
- [ ] Hero image is not unnecessarily deferred  
- [ ] Responsive image behavior is in place where possible  
- [ ] Images have width/height or reserved layout space where practical  
- [ ] At least the key article images are referenced in surrounding text

### Metadata / Technical

- [ ] Title is present  
- [ ] Meta description is present  
- [ ] Canonical is present if applicable  
- [ ] No invalid tags are placed in `<head>`  
- [ ] Mobile viewport meta tag is present  
- [ ] HTML validates cleanly enough to avoid broken metadata handling

### Readability

- [ ] Body copy is not too wide  
- [ ] Paragraph spacing is comfortable  
- [ ] No long sections of centered text  
- [ ] Headings wrap cleanly on mobile  
- [ ] Article still feels premium, calm, and on-brand

### Performance

- [ ] Images are compressed  
- [ ] No oversized media is loaded unnecessarily  
- [ ] No decorative feature meaningfully harms load or stability  
- [ ] Layout shift is minimized  
- [ ] The page feels fast enough to read immediately

---

## 21\. Quick Reference Card

| Element | Font | Size | Weight | Color |
| :---- | :---- | :---- | :---- | :---- |
| Blog title (`h1`) | Cormorant Garamond | 48px | 600 | `#bc9b5d` |
| Section heading (`h2`) | Fraunces | 36px | 400 | `#242323` |
| Subsection heading (`h3`) | Cormorant Garamond | 28px | 600 | `#000000` |
| Minor heading (`h4`) | Fraunces | 22px | 400 | `#414141` |
| Lead / intro paragraph | Fraunces | 21px | 400 | `#414141` |
| Body text | Nunito Sans | 16px | 300 | `#000000` |
| Body text bold | Nunito Sans | 16px | 700 | `#000000` |
| Pull quote | Cormorant Garamond | 24px | 300 | `#624c40` |
| Image caption | Trirong | 13px | 400 | `#414141` |
| Body links | inherit | inherit | inherit | `#bc9b5d` |
| Footer / utility text | Trirong | 12px | 400 | `#000000` |

---

## 22\. Final Positioning

This guide should be used whenever BWC blog content is created in HTML or adapted into a custom article template.

Its job is simple:

**Protect the brand look while ensuring the implementation layer remains readable, accessible, crawlable, and strong enough to support top-tier SEO execution.**

If a styling choice conflicts with:

- semantic structure  
- readability  
- accessibility  
- crawlability  
- mobile usability  
- stable rendering

then the styling choice must be revised.

---

*This guide preserves the visual language of the live Bhutan Wine Company site while adding the implementation standards required for modern editorial, accessibility, and search-friendly publishing.*  
