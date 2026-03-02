/**
 * Complete embedded BWC blog stylesheet.
 * Source: Brand Style Guide §3 (variables), §6 (typography), §7 (layout),
 * §13 (mobile), §14 (links).
 * NEVER modify these values — they come from the Brand Style Guide.
 */
export const BWC_STYLESHEET = `
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

  /* Spacing */
  --space-xs: 8px;
  --space-sm: 16px;
  --space-md: 24px;
  --space-lg: 48px;
  --space-xl: 80px;
  --space-2xl: 120px;
}

/* Layout */
.bwc-article {
  max-width: 980px;
  margin: 0 auto;
  padding: 0 var(--space-sm);
  font-family: 'Nunito Sans', sans-serif;
}

.blog-content {
  max-width: 760px;
  margin: 0 auto;
}

/* Blog Post Typography Mapping — Brand Style Guide §6 */
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

/* Links — Brand Style Guide §14 */
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

/* Images — Brand Style Guide §6 */
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

/* Lead / Intro — Brand Style Guide §6 */
article .lead,
article .intro {
  font-family: 'Fraunces', serif;
  font-size: 21px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--bwc-text-secondary);
  margin-bottom: 2em;
}

/* Meta / Eyebrow / Last Updated — Brand Style Guide §6 */
article .meta,
article .eyebrow,
article .last-updated {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--bwc-text-secondary);
}

/* BEM Components */
.bwc-executive-summary {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.7;
  color: var(--bwc-text-primary);
  margin-bottom: 1.5em;
}

.bwc-pullquote {
  font-family: 'Cormorant Garamond', serif;
  font-size: 24px;
  font-weight: 300;
  line-height: 1.5;
  color: var(--bwc-text-brown);
  border-left: 3px solid var(--bwc-gold);
  padding-left: 1.25em;
  margin: 2em 0;
  font-style: italic;
}

.bwc-pullquote cite {
  font-style: normal;
  font-size: 14px;
  color: var(--bwc-text-secondary);
  display: block;
  margin-top: 0.5em;
}

.bwc-key-facts {
  background: var(--bwc-bg-cream);
  padding: var(--space-md);
  margin: 2em 0;
  border-radius: 4px;
}

.bwc-key-facts__title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 22px;
  font-weight: 600;
  color: var(--bwc-text-primary);
  margin: 0 0 var(--space-sm);
}

.bwc-key-facts__list {
  margin: 0;
  padding: 0;
}

.bwc-key-facts__list dt {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: var(--bwc-text-secondary);
  margin-top: var(--space-xs);
}

.bwc-key-facts__list dd {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 16px;
  font-weight: 300;
  color: var(--bwc-text-primary);
  margin: 2px 0 0 0;
}

.bwc-callout {
  padding: var(--space-md);
  margin: 2em 0;
  border-radius: 4px;
  border-left: 3px solid var(--bwc-gold);
}

.bwc-callout--info {
  background: var(--bwc-bg-blue);
}

.bwc-callout--tip {
  background: var(--bwc-bg-cream);
}

.bwc-callout--warning {
  background: var(--bwc-bg-peach);
}

.bwc-figure {
  margin: 2em 0;
}

.bwc-figure--decorative img {
  margin: 0 auto;
}

.bwc-faq {
  margin: var(--space-lg) 0;
}

.bwc-author-bio {
  border-top: 1px solid var(--bwc-border-light);
  padding-top: var(--space-md);
  margin-top: var(--space-lg);
}

.bwc-author-bio__name {
  font-family: 'Cormorant Garamond', serif;
  font-size: 20px;
  font-weight: 600;
  color: var(--bwc-text-primary);
}

.bwc-author-bio__credentials {
  font-family: 'Nunito Sans', sans-serif;
  font-size: 14px;
  color: var(--bwc-text-secondary);
}

.article-footer {
  border-top: 1px solid var(--bwc-border-light);
  padding-top: var(--space-sm);
  margin-top: var(--space-lg);
}

article table {
  width: 100%;
  border-collapse: collapse;
  margin: 2em 0;
  font-family: 'Nunito Sans', sans-serif;
  font-size: 15px;
}

article table caption {
  font-family: 'Trirong', serif;
  font-size: 13px;
  color: var(--bwc-text-secondary);
  text-align: left;
  margin-bottom: 0.5em;
}

article th {
  font-weight: 700;
  text-align: left;
  padding: 0.75em 1em;
  border-bottom: 2px solid var(--bwc-gold);
  color: var(--bwc-text-primary);
}

article td {
  padding: 0.75em 1em;
  border-bottom: 1px solid var(--bwc-border-light);
  color: var(--bwc-text-primary);
}

/* Mobile — Brand Style Guide §13 */
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
`.trim();
