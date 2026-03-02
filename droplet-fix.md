# Onyx CE Droplet Fix — Claude Code Execution Guide

**Purpose:** Fix a broken Onyx CE self-hosted deployment on DigitalOcean so that `https://rmoss-onyx.xyz` serves the Onyx UI, Google OAuth works, and Google Drive connector can sync.

**Execution method:** Claude Code runs all commands from the local Windows machine at `C:\Users\russe\BWC_blogs` via SSH to the droplet.

---

## Infrastructure Context

| Component | Detail |
|---|---|
| **Droplet** | DigitalOcean, Ubuntu 24.04 LTS x64, 4GB RAM, 80GB disk, NYC3 |
| **Droplet Public IP** | `159.65.45.1` |
| **Droplet Private IP** | `10.108.0.2` |
| **Droplet hostname** | `ubuntu-s-1vcpu-512mb-10gb-nyc3-01` |
| **Domain** | `rmoss-onyx.xyz` |
| **DNS/CDN** | Cloudflare (proxy enabled, orange cloud) |
| **Cloudflare nameservers** | `alexia.ns.cloudflare.com`, `darl.ns.cloudflare.com` |
| **Application** | Onyx CE (Community Edition), Docker Compose deployment |
| **Goal** | Google OAuth login → Onyx UI → Google Drive connector sync |

## Current Failure State

1. `https://rmoss-onyx.xyz` returns **Cloudflare Error 522** (origin unreachable)
2. `curl -I http://localhost` from inside the droplet returns **connection reset by peer**
3. `curl -I http://159.65.45.1` from inside the droplet returns **couldn't connect to server**
4. The `onyx-api_server-1` container is **crash-looping** — it fails to resolve `inference_model_server` (a service not present in the compose file)
5. The `onyx-web_server-1` returns **HTTP 500** because it depends on the broken api_server
6. nginx accepts TCP connections but resets them because all upstreams are failing
7. UFW firewall is **disabled** (confirmed not a firewall issue)
8. SSH access works fine

## Root Cause

The api_server startup fails with:

```
requests.exceptions.ConnectionError: Failed to resolve 'inference_model_server'
ERROR: Application startup failed. Exiting.
```

This is a CPU-only 4GB droplet. The Onyx compose configuration is either:
- Using a GPU/inference profile that expects a model server container, OR
- Missing an environment variable that disables the local model server, OR
- Using the wrong docker-compose file variant

---

## SSH Access Pattern

All commands must be executed from the local machine via SSH:

```bash
# Single command
ssh root@159.65.45.1 "command here"

# Multi-line commands
ssh root@159.65.45.1 'bash -s' <<'EOF'
command 1
command 2
EOF
```

---

## Phase 1: Reconnaissance — Read Before You Touch

**Goal:** Understand the exact state of the deployment before making any changes.

### 1.1 Verify SSH connectivity

```bash
ssh root@159.65.45.1 "echo 'SSH OK' && hostname && uname -a"
```

### 1.2 Find the Onyx deployment directory

```bash
ssh root@159.65.45.1 "find / -name 'docker-compose*.yml' -path '*onyx*' 2>/dev/null; find / -name 'docker-compose*.yml' -path '*danswer*' 2>/dev/null; find / -maxdepth 4 -name 'docker-compose.yml' 2>/dev/null"
```

Note: Onyx was formerly called "Danswer" — check for both names.

### 1.3 Read the docker-compose file(s) completely

Once you find the compose file path, read it in full:

```bash
ssh root@159.65.45.1 "cat /path/to/docker-compose.yml"
```

Also check for override files:

```bash
ssh root@159.65.45.1 "ls -la /path/to/docker-compose*.yml"
```

### 1.4 Read the .env file completely

```bash
ssh root@159.65.45.1 "find / -name '.env' -path '*onyx*' 2>/dev/null; find / -name '.env.prod' -path '*onyx*' 2>/dev/null"
ssh root@159.65.45.1 "cat /path/to/.env"
```

### 1.5 Check current container states

```bash
ssh root@159.65.45.1 "docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

### 1.6 Read api_server logs for the full crash trace

```bash
ssh root@159.65.45.1 "docker logs onyx-api_server-1 --tail 100 2>&1"
```

### 1.7 Read the nginx config

```bash
ssh root@159.65.45.1 "docker exec onyx-nginx-1 cat /etc/nginx/nginx.conf"
ssh root@159.65.45.1 "docker exec onyx-nginx-1 ls /etc/nginx/conf.d/ 2>/dev/null"
```

### 1.8 Check available disk and memory

```bash
ssh root@159.65.45.1 "free -h && echo '---' && df -h /"
```

### 1.9 Check if swap exists

```bash
ssh root@159.65.45.1 "swapon --show"
```

**Phase 1 acceptance:** You have read and understand the compose file, env file, nginx config, and the exact api_server crash trace. Do not proceed until all files are read.

---

## Phase 2: Fix the API Server Crash

**Goal:** Make the api_server container start successfully on this CPU-only droplet.

### 2.1 Determine the correct fix

Based on Phase 1 reconnaissance, one of these applies:

**Scenario A — Wrong compose profile:** If there are multiple compose files (e.g., `docker-compose.yml` and `docker-compose.dev.yml` or `docker-compose.gpu.yml`), the deployment may be using the wrong one. Switch to the CPU-only / non-GPU variant.

**Scenario B — Missing env variable:** Onyx CE typically needs `DISABLE_MODEL_SERVER=true` or `MODEL_SERVER_HOST=` set to empty, or `ENABLE_MINI_CHUNK=false` to skip the inference model server on CPU-only deployments. Check the Onyx CE docs/compose file comments for the correct variable name.

**Scenario C — Missing service definition:** The `inference_model_server` service may need to be added to the compose file if the deployment expects it. On Onyx CE, this is typically the `model_server` service using `onyxdotapp/onyx-model-server:latest`.

### 2.2 Apply the fix

Based on what you found in Phase 1, make the minimum necessary edit:

- If editing `.env`, use `sed` or write the file via `cat > ... <<'EOF'`
- If editing `docker-compose.yml`, use `sed` for targeted edits
- **NEVER delete or recreate postgres volumes** — preserve all data
- **Back up any file before editing it:**

```bash
ssh root@159.65.45.1 "cp /path/to/docker-compose.yml /path/to/docker-compose.yml.bak.$(date +%s)"
ssh root@159.65.45.1 "cp /path/to/.env /path/to/.env.bak.$(date +%s)"
```

### 2.3 Ensure swap exists (prevent OOM on 4GB)

If no swap was found in 1.9:

```bash
ssh root@159.65.45.1 'bash -s' <<'EOF'
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Swap created"
else
  echo "Swap already exists"
fi
free -h
EOF
```

### 2.4 Restart the deployment

```bash
ssh root@159.65.45.1 "cd /path/to/onyx && docker compose down && docker compose up -d"
```

### 2.5 Wait for healthy startup

```bash
ssh root@159.65.45.1 'bash -s' <<'EOF'
echo "Waiting for containers to stabilize..."
for i in $(seq 1 30); do
  sleep 5
  STATUS=$(docker ps --format '{{.Names}} {{.Status}}' | grep api_server)
  echo "[$i] $STATUS"
  if echo "$STATUS" | grep -q "healthy"; then
    echo "API server is healthy!"
    break
  fi
done
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
EOF
```

### 2.6 Verify api_server is no longer crashing

```bash
ssh root@159.65.45.1 "docker logs onyx-api_server-1 --tail 30 2>&1"
```

Look for: `Application startup complete` or similar success message. No `Application startup failed`.

**Phase 2 acceptance:** `docker ps` shows api_server as healthy (or at least Up without restart loops). Logs show successful startup.

---

## Phase 3: Verify Local Connectivity

**Goal:** Port 80 responds on localhost and on the public IP.

### 3.1 Test localhost

```bash
ssh root@159.65.45.1 "curl -I --max-time 10 http://localhost"
```

Expected: HTTP 200 or 302 (redirect to login).

### 3.2 Test public IP

```bash
ssh root@159.65.45.1 "curl -I --max-time 10 http://159.65.45.1"
```

Expected: HTTP 200 or 302.

### 3.3 If still failing, check nginx logs

```bash
ssh root@159.65.45.1 "docker logs onyx-nginx-1 --tail 30 2>&1"
```

### 3.4 If web_server still returns 500

```bash
ssh root@159.65.45.1 "docker logs onyx-web_server-1 --tail 50 2>&1"
```

If web_server needs a restart after api_server becomes healthy:

```bash
ssh root@159.65.45.1 "cd /path/to/onyx && docker compose restart web_server nginx"
```

**Phase 3 acceptance:** `curl -I http://localhost` and `curl -I http://159.65.45.1` both return HTTP 200 or 302 from inside the droplet.

---

## Phase 4: Verify Cloudflare → Droplet Connectivity

**Goal:** `https://rmoss-onyx.xyz` loads the Onyx UI.

### 4.1 Test from local machine (not SSH)

Run this directly on the local Windows machine (not via SSH):

```bash
curl -I https://rmoss-onyx.xyz
```

Expected: HTTP 200 or 302 from the Onyx app (not Cloudflare 522).

### 4.2 If still 522 — check Cloudflare SSL mode

Cloudflare SSL must be set to **"Flexible"** or **"Full"** (NOT "Full (Strict)"), because the droplet is serving plain HTTP on port 80 and Cloudflare terminates TLS.

This cannot be checked via SSH. Instruct the user:

> **Manual step required:** In Cloudflare dashboard → SSL/TLS → Overview, ensure the mode is set to "Flexible" or "Full". If it says "Full (Strict)", change it to "Full".

### 4.3 If still 522 — verify Cloudflare DNS record

Instruct the user:

> **Manual step required:** In Cloudflare dashboard → DNS, verify:
> - Type: `A`
> - Name: `@` (or `rmoss-onyx.xyz`)
> - Content: `159.65.45.1`
> - Proxy status: Proxied (orange cloud)

### 4.4 If still 522 — check iptables

```bash
ssh root@159.65.45.1 "iptables -L -n --line-numbers"
```

If there are DROP or REJECT rules on port 80, flush them:

```bash
ssh root@159.65.45.1 "iptables -F && iptables -X"
```

Note: Docker manages its own iptables chains. Only flush if there are clearly blocking rules.

**Phase 4 acceptance:** `https://rmoss-onyx.xyz` loads in a browser (may show Onyx login page or setup wizard).

---

## Phase 5: Configure Onyx for Domain + Google OAuth

**Goal:** Onyx knows its public URL and Google OAuth redirect works.

### 5.1 Set the Onyx domain environment variables

The `.env` file needs to tell Onyx its public domain. Add or update these variables:

```bash
ssh root@159.65.45.1 'bash -s' <<'EOF'
ENV_FILE="/path/to/.env"

# Add/update WEB_DOMAIN (adjust path from Phase 1)
grep -q "^WEB_DOMAIN=" "$ENV_FILE" && \
  sed -i 's|^WEB_DOMAIN=.*|WEB_DOMAIN=https://rmoss-onyx.xyz|' "$ENV_FILE" || \
  echo 'WEB_DOMAIN=https://rmoss-onyx.xyz' >> "$ENV_FILE"

# Add/update DOMAIN (some versions use this)
grep -q "^DOMAIN=" "$ENV_FILE" && \
  sed -i 's|^DOMAIN=.*|DOMAIN=https://rmoss-onyx.xyz|' "$ENV_FILE" || \
  echo 'DOMAIN=https://rmoss-onyx.xyz' >> "$ENV_FILE"

echo "Updated .env:"
grep -E "^(WEB_DOMAIN|DOMAIN|AUTH_TYPE|GOOGLE)" "$ENV_FILE"
EOF
```

### 5.2 Configure Google OAuth credentials

If not already set, the `.env` needs:

```
AUTH_TYPE=google_oauth
GOOGLE_OAUTH_CLIENT_ID=<your-client-id>
GOOGLE_OAUTH_CLIENT_SECRET=<your-client-secret>
```

**Manual step required for the user:** In Google Cloud Console:
1. Go to APIs & Services → Credentials
2. Create or edit an OAuth 2.0 Client ID
3. Add `https://rmoss-onyx.xyz/auth/oauth/callback` as an Authorized Redirect URI
4. Copy the Client ID and Client Secret

Then set them:

```bash
ssh root@159.65.45.1 'bash -s' <<'EOF'
ENV_FILE="/path/to/.env"

# Set auth type
grep -q "^AUTH_TYPE=" "$ENV_FILE" && \
  sed -i 's|^AUTH_TYPE=.*|AUTH_TYPE=google_oauth|' "$ENV_FILE" || \
  echo 'AUTH_TYPE=google_oauth' >> "$ENV_FILE"

# Set Google OAuth Client ID (REPLACE WITH ACTUAL VALUE)
grep -q "^GOOGLE_OAUTH_CLIENT_ID=" "$ENV_FILE" && \
  sed -i 's|^GOOGLE_OAUTH_CLIENT_ID=.*|GOOGLE_OAUTH_CLIENT_ID=YOUR_CLIENT_ID_HERE|' "$ENV_FILE" || \
  echo 'GOOGLE_OAUTH_CLIENT_ID=YOUR_CLIENT_ID_HERE' >> "$ENV_FILE"

# Set Google OAuth Client Secret (REPLACE WITH ACTUAL VALUE)
grep -q "^GOOGLE_OAUTH_CLIENT_SECRET=" "$ENV_FILE" && \
  sed -i 's|^GOOGLE_OAUTH_CLIENT_SECRET=.*|GOOGLE_OAUTH_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE|' "$ENV_FILE" || \
  echo 'GOOGLE_OAUTH_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE' >> "$ENV_FILE"

echo "Auth config:"
grep -E "^(AUTH_TYPE|GOOGLE_OAUTH)" "$ENV_FILE"
EOF
```

### 5.3 Restart after config changes

```bash
ssh root@159.65.45.1 "cd /path/to/onyx && docker compose down && docker compose up -d"
```

Wait for healthy:

```bash
ssh root@159.65.45.1 'bash -s' <<'EOF'
for i in $(seq 1 30); do
  sleep 5
  STATUS=$(docker ps --format '{{.Names}} {{.Status}}' | grep api_server)
  echo "[$i] $STATUS"
  if echo "$STATUS" | grep -q "healthy"; then
    echo "Ready!"
    break
  fi
done
EOF
```

### 5.4 Verify OAuth login works

Instruct the user:

> **Manual step:** Open `https://rmoss-onyx.xyz` in your browser. You should see a Google login button. Click it, authenticate, and confirm you land on the Onyx dashboard.

**Phase 5 acceptance:** Google OAuth login succeeds at `https://rmoss-onyx.xyz`.

---

## Phase 6: Enable Google Drive Connector

**Goal:** Onyx can index documents from Google Drive.

### 6.1 Ensure Google Drive API is enabled

**Manual step for the user:**
1. In Google Cloud Console → APIs & Services → Library
2. Search for "Google Drive API"
3. Enable it
4. Also enable "Google Docs API" and "Google Sheets API" if you want those parsed

### 6.2 Create a Service Account (if required by Onyx)

Some Onyx connectors use a service account. Check the Onyx docs. If needed:

**Manual step for the user:**
1. Google Cloud Console → IAM & Admin → Service Accounts
2. Create a service account
3. Download the JSON key
4. Upload it to the droplet

```bash
# From local machine, copy the service account key to the droplet
scp /path/to/service-account-key.json root@159.65.45.1:/path/to/onyx/
```

### 6.3 Configure Google Drive connector in Onyx UI

**Manual step for the user:**
1. Log into `https://rmoss-onyx.xyz`
2. Go to Admin → Connectors
3. Add Google Drive connector
4. Follow the Onyx UI prompts to authenticate and select folders

**Phase 6 acceptance:** Google Drive connector shows as "Connected" in the Onyx admin panel and begins indexing documents.

---

## Phase 7: Final Verification Checklist

Run all checks to confirm everything works end to end.

### 7.1 Container health

```bash
ssh root@159.65.45.1 "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

All containers should show `Up` with no restart loops. api_server should show `healthy`.

### 7.2 Local HTTP

```bash
ssh root@159.65.45.1 "curl -I --max-time 10 http://localhost"
```

### 7.3 Public HTTP

```bash
ssh root@159.65.45.1 "curl -I --max-time 10 http://159.65.45.1"
```

### 7.4 Domain HTTPS (from local machine)

```bash
curl -I https://rmoss-onyx.xyz
```

### 7.5 No crash loops

```bash
ssh root@159.65.45.1 "docker ps -a --format '{{.Names}} {{.Status}}' | grep -i restart"
```

Should return nothing.

### 7.6 Memory is stable

```bash
ssh root@159.65.45.1 "free -h"
```

Should show swap available and memory not fully consumed.

---

## Troubleshooting Quick Reference

| Symptom | Check | Fix |
|---|---|---|
| api_server crash: `inference_model_server` not found | `.env` or compose file missing model server config | Add `DISABLE_MODEL_SERVER=true` or add the model_server service |
| 522 from Cloudflare | Port 80 not responding on droplet | Fix upstreams, check iptables |
| 502 Bad Gateway | nginx up but upstream down | Wait for api_server healthy, restart nginx |
| OAuth redirect mismatch | Google Console redirect URI wrong | Set to `https://rmoss-onyx.xyz/auth/oauth/callback` |
| OOM / containers killed | 4GB RAM exhausted | Ensure swap exists, reduce vespa memory if possible |
| web_server 500 | api_server not healthy | Fix api_server first, then restart web_server |

---

## Critical Safety Rules

- **NEVER delete Docker volumes** — postgres data lives there
- **ALWAYS back up files before editing** — `.bak.$(date +%s)` suffix
- **Read files completely before editing**
- **Diagnose before fixing** — understand the root cause
- **One change at a time** — restart and verify after each fix
- **Replace `/path/to/onyx`** with the actual path found in Phase 1

---

*Document created: March 1, 2026*
*Target: Claude Code agentic execution from `C:\Users\russe\BWC_blogs`*
