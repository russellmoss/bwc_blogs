"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function GetStartedPage() {
  return (
    <div style={{ height: "100%", overflow: "auto", position: "relative" }}>
      <Link
        href="/dashboard"
        className="gs-back-btn"
        style={{
          position: "sticky",
          top: "16px",
          left: "16px",
          zIndex: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 16px",
          background: "#3b2f20",
          color: "#ffffff",
          fontSize: "13px",
          fontWeight: 500,
          fontFamily: "'Nunito Sans', sans-serif",
          textDecoration: "none",
          borderRadius: "100px",
          boxShadow: "0 4px 12px rgba(59,47,32,0.25)",
          float: "left",
          margin: "16px 0 0 16px",
        }}
      >
        <ArrowLeft style={{ width: "14px", height: "14px" }} />
        Back to Composer
      </Link>
      <style>{`
        .gs-root {
          --bg-primary: #f5f0e8;
          --bg-card: #faf7f2;
          --bg-white: #ffffff;
          --bg-warm: #ede6da;
          --text-primary: #3b2f20;
          --text-secondary: #6b5b4a;
          --text-muted: #8a7b6a;
          --accent-gold: #bc9b5d;
          --accent-brown: #624c40;
          --border-light: #ddd5c8;
          --border-subtle: #e8e0d4;
          --shadow-sm: 0 1px 3px rgba(59,47,32,0.06);
          --shadow-md: 0 4px 16px rgba(59,47,32,0.08);
          --shadow-lg: 0 8px 32px rgba(59,47,32,0.10);
          --radius: 12px;
          --radius-sm: 8px;
        }
        .gs-back-btn:hover {
          background: #624c40 !important;
        }
        .gs-root {
          font-family: 'Nunito Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          background: var(--bg-primary);
          color: var(--text-primary);
          line-height: 1.7;
          -webkit-font-smoothing: antialiased;
        }
        .gs-root html { scroll-behavior: smooth; }
        .gs-hero {
          background: linear-gradient(168deg, #3b2f20 0%, #624c40 55%, #8a6d4f 100%);
          color: #fff;
          padding: 80px 24px 72px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .gs-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 30% 20%, rgba(188,155,93,0.15) 0%, transparent 60%);
        }
        .gs-hero-inner { position: relative; max-width: 720px; margin: 0 auto; }
        .gs-hero-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: var(--accent-gold);
          border: 1px solid rgba(188,155,93,0.4);
          padding: 6px 18px;
          border-radius: 100px;
          margin-bottom: 28px;
        }
        .gs-hero h1 {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(2.2rem, 5vw, 3.4rem);
          font-weight: 500;
          line-height: 1.15;
          margin-bottom: 20px;
          color: #fff;
        }
        .gs-hero h1 span { color: var(--accent-gold); }
        .gs-hero p {
          font-size: 1.05rem;
          font-weight: 300;
          color: rgba(255,255,255,0.78);
          max-width: 560px;
          margin: 0 auto;
          line-height: 1.75;
        }
        .gs-toc {
          max-width: 800px;
          margin: -36px auto 0;
          padding: 0 24px;
          position: relative;
          z-index: 2;
        }
        .gs-toc-inner {
          background: var(--bg-white);
          border-radius: var(--radius);
          box-shadow: var(--shadow-lg);
          padding: 32px 36px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        .gs-toc a {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: var(--text-secondary);
          font-size: 0.88rem;
          font-weight: 500;
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          transition: all 0.2s ease;
        }
        .gs-toc a:hover { background: var(--bg-warm); color: var(--text-primary); }
        .gs-toc-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--bg-primary);
          color: var(--accent-gold);
          font-size: 0.75rem;
          font-weight: 600;
          flex-shrink: 0;
        }
        .gs-content { max-width: 800px; margin: 0 auto; padding: 56px 24px 80px; }
        .gs-step-section { margin-bottom: 56px; }
        .gs-step-section:last-child { margin-bottom: 0; }
        .gs-step-header { display: flex; align-items: flex-start; gap: 20px; margin-bottom: 24px; }
        .gs-step-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--accent-gold);
          color: #fff;
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.2rem;
          font-weight: 600;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .gs-step-header h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.65rem;
          font-weight: 500;
          color: var(--text-primary);
          line-height: 1.3;
          margin: 0;
        }
        .gs-step-subtitle {
          display: block;
          font-family: 'Nunito Sans', sans-serif;
          font-size: 0.82rem;
          font-weight: 400;
          color: var(--text-muted);
          margin-top: 4px;
          letter-spacing: 0.3px;
        }
        .gs-step-body {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius);
          padding: 28px 32px;
          box-shadow: var(--shadow-sm);
        }
        .gs-step-body p { margin-bottom: 16px; color: var(--text-secondary); font-size: 0.95rem; line-height: 1.75; }
        .gs-step-body p:last-child { margin-bottom: 0; }
        .gs-callout {
          background: var(--bg-warm);
          border-left: 3px solid var(--accent-gold);
          border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
          padding: 16px 20px;
          margin: 20px 0;
          font-size: 0.88rem;
          color: var(--accent-brown);
          line-height: 1.7;
        }
        .gs-callout strong { color: var(--text-primary); }
        .gs-checklist { list-style: none; margin: 16px 0; padding: 0; }
        .gs-checklist li {
          position: relative;
          padding: 8px 0 8px 32px;
          font-size: 0.92rem;
          color: var(--text-secondary);
          line-height: 1.65;
        }
        .gs-checklist li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 12px;
          width: 18px;
          height: 18px;
          border-radius: 4px;
          border: 1.5px solid var(--border-light);
          background: var(--bg-white);
        }
        .gs-checklist li::after {
          content: '\\2713';
          position: absolute;
          left: 3px;
          top: 10px;
          font-size: 13px;
          color: var(--accent-gold);
          font-weight: 700;
        }
        .gs-tag {
          display: inline-block;
          background: rgba(188,155,93,0.12);
          color: var(--accent-brown);
          font-size: 0.75rem;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 100px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .gs-divider { border: none; height: 1px; background: var(--border-subtle); margin: 0 0 56px; }
        .gs-footer {
          text-align: center;
          padding: 40px 24px;
          border-top: 1px solid var(--border-subtle);
          color: var(--text-muted);
          font-size: 0.82rem;
        }
        .gs-footer a { color: var(--accent-gold); text-decoration: none; }
        .gs-footer a:hover { text-decoration: underline; }
        .gs-prompt-example {
          background: var(--text-primary);
          color: rgba(255,255,255,0.88);
          border-radius: var(--radius-sm);
          padding: 20px 24px;
          margin: 20px 0;
          font-family: 'Courier New', monospace;
          font-size: 0.84rem;
          line-height: 1.8;
          white-space: pre-wrap;
          word-break: break-word;
          position: relative;
        }
        .gs-prompt-label {
          position: absolute;
          top: -10px;
          left: 16px;
          background: var(--accent-gold);
          color: #fff;
          font-family: 'Nunito Sans', sans-serif;
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 2px 10px;
          border-radius: 4px;
        }
        @media (max-width: 640px) {
          .gs-hero { padding: 56px 20px 52px; }
          .gs-toc-inner { grid-template-columns: 1fr; padding: 24px 20px; }
          .gs-step-header { gap: 14px; }
          .gs-step-number { width: 36px; height: 36px; font-size: 1rem; }
          .gs-step-body { padding: 20px 22px; }
          .gs-prompt-example { font-size: 0.78rem; padding: 18px 16px; }
        }
      `}</style>

      <div className="gs-root">
        <header className="gs-hero">
          <div className="gs-hero-inner">
            <div className="gs-hero-badge">Quick-Start Primer</div>
            <h1>Getting Started with the <span>BWC Content Engine</span></h1>
            <p>A step-by-step guide for the Bhutan Wine Company team to begin producing publication-ready, SEO-optimized blog content.</p>
          </div>
        </header>

        <nav className="gs-toc">
          <div className="gs-toc-inner">
            <a href="#step-1"><span className="gs-toc-num">1</span> Upload Photos</a>
            <a href="#step-2"><span className="gs-toc-num">2</span> Enrich Descriptions</a>
            <a href="#step-3"><span className="gs-toc-num">3</span> Image Quality</a>
            <a href="#step-4"><span className="gs-toc-num">4</span> Know Your Content Map</a>
            <a href="#step-5"><span className="gs-toc-num">5</span> Compose &amp; Prompt</a>
            <a href="#step-6"><span className="gs-toc-num">6</span> Generate &amp; Edit</a>
            <a href="#step-7"><span className="gs-toc-num">7</span> Publish to Wix</a>
          </div>
        </nav>

        <main className="gs-content">

          <section id="step-1" className="gs-step-section">
            <div className="gs-step-header">
              <span className="gs-step-number">1</span>
              <h2>Upload 50–100 High-Quality Photos <span className="gs-step-subtitle">Build the visual library the AI draws from when composing articles</span></h2>
            </div>
            <div className="gs-step-body">
              <p>Navigate to the <strong>Photos</strong> section in the app. This is the visual library that the AI pulls from when generating articles — the richer it is, the better your content will look.</p>
              <p>Click <strong>Upload Photos</strong> and select your images. The system accepts batches of up to <strong>10 images at a time</strong>, so you&#39;ll work through this in rounds. Aim for 50 to 100 images before you start writing your first article.</p>
              <div className="gs-callout">
                <strong>What to upload:</strong> Vineyard landscapes, winemaking process shots, team portraits, bottle photography, tasting events, Bhutanese scenery, harvest moments, cellar interiors — anything that tells the BWC story visually.
              </div>
              <p>You can always add more images later, and the system will use what&#39;s available. But starting with a solid foundation of 50+ images means the AI has real choices to work with from day one.</p>
            </div>
          </section>

          <hr className="gs-divider" />

          <section id="step-2" className="gs-step-section">
            <div className="gs-step-header">
              <span className="gs-step-number">2</span>
              <h2>Enrich the AI-Generated Descriptions <span className="gs-step-subtitle">Add personality, names, and specifics that make articles authentic</span></h2>
            </div>
            <div className="gs-step-body">
              <p>After uploading, the system automatically generates an AI description for each image. These are a decent starting point, but they&#39;re generic. Your job is to make them <em>specific</em> — because these descriptions are what the AI reads when deciding how to use an image in an article.</p>
              <p>Click into each photo and review its description. Then add the details that only a human would know:</p>
              <ul className="gs-checklist">
                <li>If there are <strong>people in the photo</strong>, name them from left to right</li>
                <li>Include their <strong>role</strong> — &quot;Mike, co-founder and winemaker&quot; not just &quot;Mike&quot;</li>
                <li>Add <strong>location specifics</strong> — &quot;the Paro Valley vineyard at 2,300m elevation&quot;</li>
                <li>Note the <strong>context</strong> — &quot;during the 2024 harvest&quot; or &quot;at the inaugural tasting event&quot;</li>
                <li>Mention <strong>what&#39;s happening</strong> — &quot;inspecting Pinot Noir clusters for veraison&quot;</li>
              </ul>
              <div className="gs-callout">
                <strong>Why this matters:</strong> The AI uses these descriptions verbatim when composing articles. A description that says &quot;Group of people at a vineyard&quot; produces generic copy. A description that says &quot;Matt Brain and Mike examining Tempranillo rootstock at the Punakha test plot, March 2024&quot; produces compelling, specific, trustworthy content.
              </div>
            </div>
          </section>

          <hr className="gs-divider" />

          <section id="step-3" className="gs-step-section">
            <div className="gs-step-header">
              <span className="gs-step-number">3</span>
              <h2>Ensure Image Quality Standards <span className="gs-step-subtitle">High-resolution images are non-negotiable for professional publishing</span></h2>
            </div>
            <div className="gs-step-body">
              <p>Before you upload, make sure every image meets the minimum quality bar. Your blog posts will appear on bhutanwine.com alongside premium editorial content — the images need to match that standard.</p>
              <ul className="gs-checklist">
                <li>Resolution should be <strong>300 DPI or higher</strong> at a bare minimum</li>
                <li>Images should be <strong>well-lit, in focus, and professionally composed</strong></li>
                <li>Avoid stock photos — <strong>authentic, original photography</strong> performs far better for SEO and brand trust</li>
                <li>Landscape orientation tends to work best for blog hero images and inline content</li>
              </ul>
              <div className="gs-callout">
                <strong>Pro tip:</strong> If you&#39;re pulling images from a phone camera, most modern smartphones shoot well above 300 DPI. Just make sure you&#39;re using the full-resolution originals, not compressed versions from messaging apps or social media downloads.
              </div>
            </div>
          </section>

          <hr className="gs-divider" />

          <section id="step-4" className="gs-step-section">
            <div className="gs-step-header">
              <span className="gs-step-number">4</span>
              <h2>Understand the Content Map <span className="gs-step-subtitle">38 articles are already planned and ready to generate</span></h2>
            </div>
            <div className="gs-step-body">
              <p>The app ships with a <strong>Content Map</strong> of approximately 39 planned articles — one of which has already been generated and finalized (not yet published). That leaves about <strong>38 articles</strong> ready to go.</p>
              <p>These articles follow a <strong>hub-and-spoke</strong> (or pillar-cluster) SEO strategy:</p>
              <ul className="gs-checklist">
                <li><strong>Hub articles</strong> are comprehensive pillar pages (3,000–4,000 words) that serve as authoritative resources on a broad topic</li>
                <li><strong>Spoke articles</strong> are shorter supporting pieces that dive deep on a subtopic and link back to the hub</li>
                <li>This interlinking creates a web of content that signals authority to Google and AI search engines</li>
              </ul>
              <p>Navigate to the <strong>Content Map</strong> in the app to browse all planned articles. Each entry includes the title, type (hub or spoke), target keywords, suggested external links, internal linking targets, and content notes. You don&#39;t need to generate them in order, but it&#39;s wise to <strong>publish hub articles before their spokes</strong> so internal links resolve correctly.</p>
              <div className="gs-callout">
                <strong>Publishing cadence:</strong> Aim for 2–3 articles per week. At that pace, you&#39;ll have the full initial content library published within 3–4 months — building strong topical authority across your key SEO clusters.
              </div>
            </div>
          </section>

          <hr className="gs-divider" />

          <section id="step-5" className="gs-step-section">
            <div className="gs-step-header">
              <span className="gs-step-number">5</span>
              <h2>Compose Your First Article <span className="gs-step-subtitle">Choose an article, select a style, and write a strong prompt</span></h2>
            </div>
            <div className="gs-step-body">
              <p>Go to the <strong>Composer</strong> and use the dropdown to select the article you want to generate from the content map. Then choose a <strong>writing style</strong> — the default is &quot;Luxury Editorial,&quot; which works well for BWC&#39;s brand voice. You can edit existing styles or create new ones at any time.</p>
              <p>Now write your prompt. This is where you direct the AI, and a few key details make a dramatic difference in output quality:</p>
              <ul className="gs-checklist">
                <li>Specify the <strong>author and their title</strong> — e.g., &quot;Byline: Mike, Principle of BWC&quot;</li>
                <li>Include the author&#39;s <strong>LinkedIn URL</strong> so the AI can hyperlink to it</li>
                <li>Request the right <strong>keyword density</strong> — &quot;ensure sufficient density of target keywords without keyword stuffing&quot;</li>
                <li>Ask for <strong>external links</strong> to high-authority, relevant websites</li>
                <li>Ask for <strong>internal links</strong> within bhutanwine.com</li>
                <li>Specify the <strong>article type and word count</strong> — &quot;Write this as a hub article of 3,000 words&quot;</li>
              </ul>
              <div className="gs-prompt-example">
                <span className="gs-prompt-label">Example Prompt</span>
{`Write this article as a hub article of approximately 3,000 words.

Byline: Mike, Principle of BWC, with a hyperlink
to his LinkedIn profile at [LinkedIn URL].

Ensure sufficient density of our target keywords
without keyword stuffing. Include external links
to high-authority, relevant websites (wine
publications, industry sources) as well as
internal links within www.bhutanwine.com.

Make the tone authoritative but accessible —
this should read as the definitive resource on
this topic.`}
              </div>
              <div className="gs-callout">
                <strong>Author bylines matter for SEO:</strong> Attributing articles to a real person with a linked professional profile signals to Google and AI models that the content is written by a credible authority. Always include author name, title, and LinkedIn URL.
              </div>
            </div>
          </section>

          <hr className="gs-divider" />

          <section id="step-6" className="gs-step-section">
            <div className="gs-step-header">
              <span className="gs-step-number">6</span>
              <h2>Generate, Review, Edit &amp; QA <span className="gs-step-subtitle">Watch the article form, edit in Canvas, then run the quality checks</span></h2>
            </div>
            <div className="gs-step-body">
              <p>Hit <strong>Generate</strong> and watch the article compose in real time. The system will build a structured document — selecting photos from your library, generating metadata, creating internal and external links, and assembling the full article.</p>
              <p>Once generation completes, <strong>read through the article</strong>. It&#39;s a strong first pass, but there will always be things to refine. You have two primary editing paths:</p>
              <p><strong>Canvas Edit</strong> — Click &quot;Canvas&quot; to enter a rich editing mode where you can directly modify text, and the underlying HTML updates automatically. This is the fastest way to make small corrections, adjust phrasing, or fix factual details.</p>
              <p><strong>External iteration with Claude</strong> — For more substantial changes, copy the HTML (using the copy button), paste it into Claude.ai, and describe what you want changed. Work with Claude iteratively until you&#39;re happy, then bring the final HTML back into the app using the import feature.</p>
              <p>When you&#39;re satisfied with the content, click <strong>Run QA</strong>. The system runs a scorecard of SEO and quality checks. Any <strong>blockers</strong> (marked in red) must be resolved before you can finalize — you can usually fix these automatically by clicking <strong>&quot;Fix with AI.&quot;</strong> Warnings are advisory and less critical, though worth reviewing.</p>
              <div className="gs-callout">
                <strong>Common QA checks:</strong> Word count, internal link density, external link presence, keyword coverage, meta title/description length, heading structure, image alt text, and schema markup. The system handles the tedious parts of SEO so you can focus on the content.
              </div>
            </div>
          </section>

          <hr className="gs-divider" />

          <section id="step-7" className="gs-step-section">
            <div className="gs-step-header">
              <span className="gs-step-number">7</span>
              <h2>Finalize, Publish to Wix &amp; Close the Loop <span className="gs-step-subtitle">Export, publish, then bring the live URL back to complete the link graph</span></h2>
            </div>
            <div className="gs-step-body">
              <p>Once QA passes, click <strong>Finalize</strong>. This commits the article to the database as your approved version. From here, you&#39;ll export and manually publish to Wix:</p>
              <p><strong>Step A — Export from the app.</strong> Click <strong>&quot;Copy HTML for Wix&quot;</strong> to grab the full article markup. Also copy the <strong>Meta Title</strong> and <strong>Meta Description</strong> — you&#39;ll need both when setting up the blog post in Wix.</p>
              <p><strong>Step B — Create the post in Wix.</strong> In your Wix blog editor, create a new post, paste in the HTML, add the meta title and meta description in the SEO fields, and publish.</p>
              <p><strong>Step C — Close the loop.</strong> Once the article is live on bhutanwine.com, copy its published URL. Return to the Content Engine, find the article, click <strong>&quot;Mark Published,&quot;</strong> and paste the live URL into the dialogue. This is a critical step — the system stores this URL so that future articles can automatically generate correct internal links to your published content.</p>
              <div className="gs-callout">
                <strong>Why closing the loop matters:</strong> The hub-and-spoke strategy depends on real, working internal links. When you publish a hub article and record its URL, every future spoke article can link directly to it. Skip this step, and the internal linking strategy breaks down. Always bring the URL back.
              </div>
              <p style={{ marginTop: "20px" }}><span className="gs-tag">Recommended</span></p>
              <p>Publish <strong>hub articles first</strong>, then their spokes. This ensures that when spoke articles are generated, the hub URLs are already in the system and internal links resolve correctly from day one.</p>
            </div>
          </section>

          <hr className="gs-divider" />

          <section className="gs-step-section">
            <div className="gs-step-header">
              <span className="gs-step-number" style={{ background: "var(--accent-brown)" }}>&#10022;</span>
              <h2>Quick Recap <span className="gs-step-subtitle">The essential rhythm for getting started</span></h2>
            </div>
            <div className="gs-step-body">
              <ul className="gs-checklist">
                <li>Upload 50–100 high-quality, high-resolution images (batches of 10)</li>
                <li>Enrich every AI description with names, roles, locations, and context</li>
                <li>Select an article from the Content Map and write a detailed prompt</li>
                <li>Always include: author + LinkedIn, keyword density, external links, internal links</li>
                <li>Generate, review in Canvas, run QA, fix blockers, then finalize</li>
                <li>Export HTML + meta fields to Wix, publish, then bring the URL back to the app</li>
                <li>Aim for 2–3 articles per week — full library in 3–4 months</li>
              </ul>
              <p style={{ marginTop: "20px", color: "var(--text-muted)", fontSize: "0.88rem" }}>As you get more comfortable, you can iterate on articles externally with Claude before finalizing, create custom writing styles, expand the content map with new hubs and spokes, and continuously improve the knowledge base in Google Drive to make the AI smarter over time.</p>
            </div>
          </section>

        </main>

        <footer className="gs-footer">
          <p>BWC Content Engine — Bhutan Wine Company &nbsp;&middot;&nbsp; <a href="https://www.bhutanwine.com" target="_blank" rel="noopener noreferrer">bhutanwine.com</a></p>
        </footer>
      </div>
    </div>
  );
}
