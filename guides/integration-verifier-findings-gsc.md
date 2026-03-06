# Integration Verifier Findings - GSC Intelligence Layer
**Date:** 2026-03-05
**Guide:** SEO Intelligence Layer (GSC data sync, analysis routes, dashboard tab)
**Verifier:** Integration Verification Specialist

---

## Summary Table

| Check | Status | Notes |
|---|---|---|
| Neon Postgres connection | PASS | SELECT 1 OK, all 9 tables accessible |
| content_map has data | PASS | 39 rows, sample row confirmed |
| npm run build | PASS | Zero errors, compiled in 7.0s |
| Vercel health endpoint | PASS | HTTP 200 in 1.65s |
| GSC JSON parse | PASS | All required fields present |
| GSC private_key | PASS | Exists, starts with -----BEGIN PRIVATE KEY----- |
| GSC auth (access token) | PASS | Token obtained, length=1024 |
| GSC API live query | PASS | HTTP 200 in 0.41s, real row data returned |
| GSC property mismatch | WARN | GSC_SITE_URL=sc-domain but service account has URL-prefix access only |
| googleapis | PASS | v171.4.0 installed |
| google-auth-library | PASS | v10.6.1 installed |
| vercel.json crons | ABSENT | No cron config present yet |

---

## 1. Neon Postgres

**Status: PASS**

Connection confirmed via PrismaClient raw query against the pooled Neon endpoint.

### Table Row Counts

| Table | Rows |
|---|---|
| user | 6 |
| contentMap | 39 |
| articleDocument | 6 |
| articleHtml | 6 |
| internalLink | 10 |
| photo | 0 |
| articlePhoto | 0 |
| lead | 0 |
| leadEvent | 0 |

### Sample contentMap Row

```json
{
  id: 2,
  slug: emerging-wine-regions-exciting-wine-made,
  title: Emerging Wine Regions: Where the Most Exciting Wine Is Being Made Right Now,
  status: planned,
  articleType: hub
}
```

39 content_map rows are available for the GSC sync guide to JOIN against.
---

## 2. npm run build

**Status: PASS**

Build completed with zero TypeScript errors and zero route errors.

```
Compiled successfully in 7.0s
Generating static pages (32/32) in 572.3ms
```

All dynamic routes compile cleanly. No new warnings.

---

## 3. Vercel Health Endpoint

**Status: PASS**

```
GET https://bwc-content-engine.vercel.app/api/health
HTTP 200 in 1.65s
```

Deployed app is live and responsive.

---

## 4. GSC Service Account Credential Validation

**Status: PASS**

Credentials stored in .env under GSC_SERVICE_ACCOUNT_JSON as a single-line JSON string.

### Field Validation

| Field | Present | Value |
|---|---|---|
| type | YES | service_account |
| project_id | YES | onyx-488916 |
| client_email | YES | bwc-gsc-reader@onyx-488916.iam.gserviceaccount.com |
| client_id | YES | 100380637606107266240 |
| private_key | YES | Confirmed, starts with -----BEGIN PRIVATE KEY----- |
| private_key_id | YES | e7f9592db82e5344e0ec97fb052a14ddb7375b0a |
| auth_uri | YES | https://accounts.google.com/o/oauth2/auth |
| token_uri | YES | https://oauth2.googleapis.com/token |

JSON parsed without error. All fields required by google-auth-library GoogleAuth() are present.

### Additional GSC Env Vars

| Variable | Present | Value |
|---|---|---|
| GSC_SITE_URL | YES | sc-domain:bhutanwine.com |
| GSC_SERVICE_ACCOUNT_EMAIL | NO | Not set as standalone - email is inside GSC_SERVICE_ACCOUNT_JSON |
| GSC_PROPERTY_URL | NO | Not set |

---

## 5. Live GSC API Test

**Status: PASS (with property mismatch warning - see Issues section)**

### Auth Test

Access token obtained successfully (length=1024). Service account exchanges RSA private key for OAuth2 bearer token.

### Verified Sites for this Service Account

The GSC sites.list endpoint returned exactly one accessible property:

```json
{
  siteUrl: https://www.bhutanwine.com/,
  permissionLevel: siteFullUser
}
```

Permission level siteFullUser is sufficient for full read access including searchAnalytics/query.

### Live Query Result

- Property:   https://www.bhutanwine.com/ (URL-prefix property)
- Date range: 2025-12-01 to 2026-02-28
- Dimensions: page
- Response:   HTTP 200 in 0.41s

Response shape:

```json
{
  rows: [{ keys: [https://www.bhutanwine.com/], clicks: 240, impressions: 4024, ctr: 0.0596, position: 5.83 }],
  responseAggregationType: byProperty
}
```

Data is live. The API returns real click/impression/CTR/position metrics for bhutanwine.com.

### sc-domain Test Result

Querying sc-domain:bhutanwine.com (GSC_SITE_URL current value) returns:

    HTTP 403: User does not have sufficient permission for site sc-domain:bhutanwine.com

The service account only has access to the URL-prefix property, not the Domain property.

---

## 6. GSC Dependencies in package.json

**Status: PASS - both libraries already installed as production dependencies**

| Package | Version | Purpose |
|---|---|---|
| googleapis | ^171.4.0 | High-level GSC webmasters/searchAnalytics client |
| google-auth-library | ^10.6.1 | Service account JWT authentication |

No new npm installs needed for the GSC guide.

---

## 7. Vercel Cron Configuration

**Status: ABSENT - action required when sync route is built**

Current vercel.json has no crons section. When the sync route is ready, add:

```json
{
  crons: [{ path: /api/gsc/sync, schedule: 0 3 * * * }]
}
```

The cron route must validate Authorization: Bearer CRON_SECRET. CRON_SECRET is still a placeholder - see Issue 4.

---

## Issues Found

### Issue 1 - GSC_SITE_URL Property Mismatch (MUST FIX before sync goes live)

**Severity: High**

.env sets GSC_SITE_URL=sc-domain:bhutanwine.com but the service account only has access to https://www.bhutanwine.com/.
Any sync code that reads GSC_SITE_URL verbatim and passes it to the searchAnalytics API will receive HTTP 403.

Resolution:
- Option A (recommended, unblocks immediately): Change GSC_SITE_URL in .env to https://www.bhutanwine.com/
- Option B (broader coverage): Add bwc-gsc-reader@onyx-488916.iam.gserviceaccount.com as a GSC user
  on the Domain property (sc-domain:bhutanwine.com), then keep the existing env var.

### Issue 2 - GSC_SERVICE_ACCOUNT_EMAIL Not a Standalone Env Var

**Severity: Low**

process.env.GSC_SERVICE_ACCOUNT_EMAIL is undefined. The client_email lives inside GSC_SERVICE_ACCOUNT_JSON.
Either extract it from the parsed JSON at runtime, or add the standalone var to .env.

### Issue 3 - GSC_PROPERTY_URL Not Set

**Severity: Low**

GSC_PROPERTY_URL is absent. If guide code uses this variable name, add GSC_PROPERTY_URL=https://www.bhutanwine.com/.

### Issue 4 - CRON_SECRET Is Placeholder

**Severity: Medium (blocks production cron)**

CRON_SECRET is set to replace_me_with_another_long_random_secret.
Replace with a real random secret before deploying any cron-protected routes.
Generate: openssl rand -base64 32

---

## Recommendations for Guide Implementation

1. Use https://www.bhutanwine.com/ as the GSC property URL in all API calls.
   Fix GSC_SITE_URL or introduce GSC_PROPERTY_URL set to this value.

2. Authenticate by parsing process.env.GSC_SERVICE_ACCOUNT_JSON and passing to
   new GoogleAuth({ credentials: parsedJson, scopes: [webmasters.readonly scope] }).
   Do not rely on a separate email env var.

3. Apply a 3-day lag to the query end date. GSC data is typically delayed 2-3 days.
   For a daily cron, fetch a 7-day rolling window to catch late-arriving data.

4. Row shape from searchAnalytics/query: { keys: string[], clicks: number,
   impressions: number, ctr: number, position: number }.
   Design the Prisma gscPerformance model around these four metrics.

5. Add a crons entry to vercel.json when the sync route is ready.
   Suggested schedule: 0 3 * * * (3 AM UTC daily).

6. 39 contentMap rows are ready to JOIN against GSC page data.
   Map https://www.bhutanwine.com/blog/{slug} to contentMap.slug for per-article attribution.

---

## Data State at Verification Time

| Metric | Value |
|---|---|
| contentMap rows | 39 |
| articleDocument rows | 6 |
| GSC data available | Yes - real clicks/impressions from Dec 2025 onward confirmed |
| Build status | Passing, zero errors |
| Deployed app | Live at https://bwc-content-engine.vercel.app |
