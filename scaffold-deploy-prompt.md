# Claude Code Prompt — Scaffold + GitHub Push + Vercel Deploy

You are working in `C:\Users\russe\BWC_blogs`. This directory already has project files including a `.env` with live credentials.

- GitHub repo: https://github.com/russellmoss/bwc_blogs
- Vercel team: https://vercel.com/russell-moss-projects

## Goal
Scaffold a minimal Next.js app, push to the existing GitHub repo, set up Vercel project via CLI, and do the first deploy. This gets us:
1. A live Vercel project linked to the GitHub repo
2. Auto-deploys on push
3. A production URL we can use
4. Ready for Neon Postgres integration (done manually in Vercel dashboard after)

## Constraints
- Do NOT delete or overwrite the existing `.env` — it has live credentials
- Do NOT commit `.env` or any secrets to git
- Use `.env` everywhere — NOT `.env.local`
- Repo already exists at `https://github.com/russellmoss/bwc_blogs`
- Vercel scope/team: `russell-moss-projects`

---

## Step 1 — Check existing state

Before doing anything:
```bash
ls -la
cat .env
git remote -v 2>/dev/null
git status 2>/dev/null
git log --oneline -5 2>/dev/null
node -v
npm -v
```

Also check if Vercel CLI is installed:
```bash
npx vercel --version
```

Report what you find before proceeding.

---

## Step 2 — Scaffold Next.js app

If no Next.js project exists yet (no `package.json` with `next` dependency), scaffold one.

Because the directory isn't empty, scaffold in a temp directory and merge:

```bash
cd ..
npx create-next-app@latest bwc-temp --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Then carefully copy into BWC_blogs WITHOUT overwriting `.env`, `.git/`, or existing project files:

On Windows (PowerShell):
```powershell
# Copy scaffold files, skip .env and .git
Get-ChildItem -Path ..\bwc-temp -Exclude '.git','.env','node_modules' -Recurse | Copy-Item -Destination . -Force -Recurse
Remove-Item -Recurse -Force ..\bwc-temp
```

Or if bash is available:
```bash
cp -rn ../bwc-temp/* ../bwc-temp/.* . 2>/dev/null
rm -rf ../bwc-temp
```

Settings:
- **App Router**, **TypeScript**, **Tailwind CSS**, **ESLint**, **src/ directory**, **Import alias: @/***

---

## Step 3 — Create project structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── api/
│   │   └── health/
│   │       └── route.ts
│   └── (dashboard)/
│       └── page.tsx
├── lib/
│   ├── db/
│   │   └── index.ts
│   ├── onyx/
│   │   └── client.ts
│   ├── claude/
│   │   └── client.ts
│   ├── cloudinary/
│   │   └── client.ts
│   └── env.ts
├── types/
│   └── index.ts
└── config/
    └── site.ts
```

---

## Step 4 — Create env validation

```typescript
// src/lib/env.ts
function optionalEnv(name: string, defaultValue: string = ''): string {
  return process.env[name] || defaultValue;
}

export const env = {
  DATABASE_URL: optionalEnv('DATABASE_URL', ''),
  DIRECT_URL: optionalEnv('DIRECT_URL', ''),
  AUTH_SECRET: optionalEnv('AUTH_SECRET', ''),
  AUTH_URL: optionalEnv('AUTH_URL', 'http://localhost:3000'),
  ADMIN_EMAIL: optionalEnv('ADMIN_EMAIL', ''),
  ANTHROPIC_API_KEY: optionalEnv('ANTHROPIC_API_KEY', ''),
  ANTHROPIC_MODEL: optionalEnv('ANTHROPIC_MODEL', 'claude-sonnet-4-5-20250929'),
  ONYX_API_URL: optionalEnv('ONYX_API_URL', ''),
  ONYX_API_KEY: optionalEnv('ONYX_API_KEY', ''),
  CLOUDINARY_URL: optionalEnv('CLOUDINARY_URL', ''),
  CLOUDINARY_CLOUD_NAME: optionalEnv('CLOUDINARY_CLOUD_NAME', ''),
  CLOUDINARY_UPLOAD_PRESET: optionalEnv('CLOUDINARY_UPLOAD_PRESET', 'blog'),
  BWC_SITE_URL: optionalEnv('BWC_SITE_URL', 'https://www.bhutanwine.com'),
} as const;
```

---

## Step 5 — Create .env.example (safe to commit)

```env
# ============================================
# BWC Content Engine — Environment Variables
# ============================================
# Copy this to .env and fill in real values

# --- Database (Neon Postgres via Vercel) ---
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
DIRECT_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require

# --- Auth ---
AUTH_SECRET=generate-with-openssl-rand-base64-32
AUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=same-as-AUTH_SECRET
NEXTAUTH_URL=http://localhost:3000
ADMIN_EMAIL=your@email.com
ADMIN_NAME=Your Name
ADMIN_PASSWORD=replace-with-strong-password
CRON_SECRET=generate-with-openssl-rand-base64-32

# --- Anthropic (Claude API) ---
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929

# --- Onyx Knowledge Base ---
ONYX_API_URL=https://your-onyx-instance.xyz/api
ONYX_API_KEY=your-onyx-api-key

# --- Cloudinary ---
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_UPLOAD_FOLDER=blog
CLOUDINARY_UPLOAD_PRESET=blog
CLOUDINARY_SECURE_DELIVERY=true

# --- BWC Site ---
BWC_SITE_URL=https://www.bhutanwine.com
BWC_BLOG_BASE_URL=https://www.bhutanwine.com/blog
BWC_SITEMAP_URL=https://www.bhutanwine.com/sitemap.xml

# --- Feature Flags ---
ENABLE_CANVAS_EDIT=true
ENABLE_HTML_MODE=true
ENABLE_KNOWLEDGE_BASE=true
ENABLE_IMAGE_PIPELINE=false
ENABLE_LINK_VALIDATION=true
```

---

## Step 6 — Create health check API route

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'bwc-content-engine',
    timestamp: new Date().toISOString(),
    env: {
      hasDatabase: !!process.env.DATABASE_URL,
      hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
      hasOnyx: !!process.env.ONYX_API_KEY,
      hasCloudinary: !!process.env.CLOUDINARY_URL,
    },
  });
}
```

---

## Step 7 — Create minimal landing page

```typescript
// src/app/page.tsx
export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fcf8ed]">
      <div className="text-center">
        <h1 className="text-4xl font-serif text-[#bc9b5d] mb-4">
          BWC Content Engine
        </h1>
        <p className="text-[#414141] text-lg">
          Bhutan Wine Company — Content Production System
        </p>
        <p className="text-[#414141] text-sm mt-8">
          Deployment verified ✓
        </p>
      </div>
    </main>
  );
}
```

---

## Step 8 — Create placeholder files

```typescript
// src/lib/db/index.ts
// Prisma client will be initialized here after Neon integration
// export const db = new PrismaClient();
export {};

// src/lib/onyx/client.ts
export const onyxConfig = {
  apiUrl: process.env.ONYX_API_URL || '',
  apiKey: process.env.ONYX_API_KEY || '',
};

// src/lib/claude/client.ts
export const claudeConfig = {
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
};

// src/lib/cloudinary/client.ts
export const cloudinaryConfig = {
  url: process.env.CLOUDINARY_URL || '',
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || 'blog',
};

// src/types/index.ts
// Shared types for the BWC Content Engine
export interface Article {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'review' | 'finalized' | 'published';
}

// src/config/site.ts
export const siteConfig = {
  name: 'BWC Content Engine',
  description: 'Bhutan Wine Company — Content Production System',
  bwcSiteUrl: 'https://www.bhutanwine.com',
  bwcBlogBaseUrl: 'https://www.bhutanwine.com/blog',
};

// src/app/(dashboard)/page.tsx
export default function Dashboard() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fcf8ed]">
      <div className="text-center">
        <h1 className="text-3xl font-serif text-[#bc9b5d] mb-4">Dashboard</h1>
        <p className="text-[#414141]">Coming soon — Phase 2 build</p>
      </div>
    </main>
  );
}
```

---

## Step 9 — Ensure .gitignore is correct

`.gitignore` must include:

```
node_modules/
.next/
.env
.env.local
.env.production.local
.env.development.local
*.pem
client_secret_*.json
.vercel
```

CRITICAL: `.env` MUST be in .gitignore.

---

## Step 10 — Create vercel.json

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "regions": ["iad1"]
}
```

---

## Step 11 — Build locally

```bash
npm install
npm run build
```

Fix any errors before proceeding. The build MUST succeed.

---

## Step 12 — Commit and push to GitHub

```bash
git remote -v

# If no remote:
git remote add origin https://github.com/russellmoss/bwc_blogs.git

git add -A

# SAFETY CHECK
git status
# .env must NOT appear. If it does: git reset HEAD .env, fix .gitignore, re-add

git commit -m "Initial scaffold: Next.js skeleton for BWC Content Engine

- App Router + TypeScript + Tailwind
- Project directory structure
- Env validation layer
- Health check API endpoint
- Placeholder pages
- Ready for Vercel deploy + Neon integration"

git push -u origin main
```

If branch is `master`, adjust. If existing commits conflict and this is the first real code, force push is acceptable:
```bash
git push -u origin main --force
```

---

## Step 13 — Set up Vercel project via CLI

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Login (this may open a browser for auth)
npx vercel login

# Link to the Vercel team/scope
# When prompted:
#   - Scope: russell-moss-projects
#   - Link to existing project? No (create new)
#   - Project name: bwc-content-engine
#   - Framework: Next.js
#   - Root directory: ./
npx vercel link --yes

# If the above interactive prompts don't work well, try:
npx vercel project add bwc-content-engine
```

---

## Step 14 — Push env vars to Vercel

Read the .env file and push each variable to Vercel for production, preview, and development environments. Do NOT push DATABASE_URL or DIRECT_URL (those come from the Neon integration).

```bash
# Read .env and push each var to Vercel
# Skip DATABASE_URL and DIRECT_URL (Neon will provide these)
# Skip blank lines and comments

# Method: use vercel env add for each variable
# The format is: echo "value" | npx vercel env add NAME production preview development

# Parse .env and push all non-database, non-empty, non-comment lines:
while IFS='=' read -r key value; do
  # Skip comments, empty lines, DATABASE_URL, DIRECT_URL
  [[ "$key" =~ ^#.*$ ]] && continue
  [[ -z "$key" ]] && continue
  [[ "$key" == "DATABASE_URL" ]] && continue
  [[ "$key" == "DIRECT_URL" ]] && continue
  
  # Remove surrounding quotes from value if present
  value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  
  echo "Setting $key..."
  echo "$value" | npx vercel env add "$key" production preview development --force 2>/dev/null || \
  echo "$value" | npx vercel env add "$key" production preview development 2>/dev/null
done < .env

echo "Done pushing env vars to Vercel"
```

If the bash loop doesn't work on Windows, push them individually:
```powershell
# PowerShell alternative — push key vars manually
"value" | npx vercel env add ANTHROPIC_API_KEY production preview development
# ... repeat for each variable
```

If neither batch method works, list what needs to be set and tell the user to either:
- Use `npx vercel env pull` after manually adding them in the dashboard, OR
- Bulk paste them in Vercel dashboard → Settings → Environment Variables

---

## Step 15 — Deploy to Vercel

```bash
# Connect the GitHub repo to Vercel for auto-deploys
npx vercel git connect

# Trigger first production deploy
npx vercel --prod
```

If `vercel git connect` fails, try:
```bash
npx vercel deploy --prod
```

---

## Step 16 — Verify deployment

After deploy completes, Vercel will output a production URL.

```bash
# Test the health endpoint on the live URL
curl -s https://YOUR_VERCEL_URL/api/health | python -m json.tool 2>/dev/null || curl -s https://YOUR_VERCEL_URL/api/health
```

Also test locally:
```bash
npx vercel dev &
sleep 5
curl -s http://localhost:3000/api/health
```

---

## Step 17 — Report back

When done, report:
1. Did the local build succeed?
2. Is the code pushed to https://github.com/russellmoss/bwc_blogs?
3. Is `.env` excluded from git? (`git ls-files .env` returns nothing)
4. What is the Vercel production URL?
5. What does the `/api/health` endpoint return on the live URL?
6. Were env vars successfully pushed to Vercel?
7. Is GitHub auto-deploy connected?

After this, the user will:
- Add Neon Postgres via Vercel dashboard → Storage → Add → Neon
- Copy the Neon connection strings to local .env
- Then we start the real build

---

## Critical rules
- NEVER commit `.env` or any file containing real API keys
- NEVER delete the existing `.env`
- Verify `git status` before every commit — `.env` must NOT appear
- Use `.env` everywhere — NOT `.env.local`
- Skip DATABASE_URL and DIRECT_URL when pushing env vars to Vercel (Neon integration provides these)
- If Vercel CLI prompts interactively and you can't answer, tell the user what to do manually
- If any step fails, report the error and suggest the fix — don't silently skip
