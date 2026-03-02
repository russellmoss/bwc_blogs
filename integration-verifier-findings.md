# Integration Verifier Findings
**Date:** 2026-03-02
**Scope:** Onyx CE re-test after admin API key elevation and Claude LLM provider enabled

---

## Summary Table

| Service | Endpoint | Status | HTTP Code | Response Time | Notes |
|---|---|---|---|---|---|
| Onyx Admin Search | POST /api/admin/search | PASS | 200 | 2.63s | Previously 403, now working |
| Onyx send-chat-message | POST /api/chat/send-chat-message | PASS | 200 | 18-35s | Previously failed with LLM error; now returns grounded answer with citations |
| Onyx Create Session | POST /api/chat/create-chat-session | PASS | 200 | 40-55s | Cold-start latency; returns valid session UUID |
| Onyx Streaming send-message | POST /api/chat/send-message | PASS | 200 | ~5s first chunk | NDJSON: reasoning deltas and search docs |
| Onyx Indexing Status | POST /api/manage/admin/connector/indexing-status | PASS | 200 | 0.52s | GET returns 405; correct method is POST |

---

## Test 1: POST /api/admin/search

**Status:** PASS (previously 403, now 200)
**HTTP Code:** 200
**Response Time:** 2.634s

**Request body:**
```json
{"query": "Bajo vineyard elevation", "filters": {}}
```

**Response shape:** Array of document objects containing: document_id, chunk_ind, semantic_identifier, blurb, score (float), match_highlights (hi-tagged), source_type, updated_at.

**Top result:**
- semantic_identifier: the-grapes-vineyards_grapes_vineyards.md
- score: 6.42
- match_highlight: "The Bajo vineyard is completely flat, at around 4,000 feet in elevation, and is located just above the Sankosh river."
- updated_at: 2025-09-02T18:06:51Z

**Total documents returned:** 16 documents from Google Drive sources.

---

## Test 2: POST /api/chat/send-chat-message (LLM synthesis)

**Status:** PASS (previously failed with "No default LLM provider found")
**HTTP Code:** 200
**Response Time:** 18-35s total

**Request body:**
```json
{"message": "What is the elevation of Bajo vineyard?", "chat_session_info": {"persona_id": 0}, "stream": false, "include_citations": true}
```

**Response shape (77,401 bytes total):**
- `answer` (string): Markdown answer with inline citation links
- `answer_citationless` (string): Same answer without citation markup
- `pre_answer_reasoning` (string): Chain-of-thought summary
- `tool_calls` (array): KB search query used and raw retrieved content
- `documents` (array): Full document objects used as context

**Sample answer returned:**
"The Bajo vineyard is located at approximately 4,000 feet in elevation. It is nestled in the beautiful Punakha Valley in western Bhutan, situated on completely flat terrain just above the Sankosh river. The vineyard enjoys dry, hot temperatures year-round thanks to a protective rain shadow and gentle warming breezes, making it an ideal site for red varietals like Merlot and Cabernet Sauvignon."

**IMPORTANT:** Despite stream=false in the request, this endpoint delivers its response as a streaming HTTP body. HTTP 200 is returned on connection but the body arrives incrementally. Any caller with max-time below 35s will receive an empty or truncated body. Minimum recommended max-time: 60s.

---

## Test 3a: POST /api/chat/create-chat-session

**Status:** PASS
**HTTP Code:** 200
**Response Time:** 0.4s-55s (highly variable; LLM cold-start)
**Request body:** {"persona_id": 0}
**Response:** {"chat_session_id": "6487fd50-23de-436b-bbab-045671acac47"}

**Note:** Latency is inconsistent. Warm calls: 0.4s. Cold calls: 40-55s. Use max-time 60s.

---

## Test 3b: POST /api/chat/send-message (streaming, skip_gen_ai=true)

**Status:** PASS
**HTTP Code:** 200
**Response Time:** First NDJSON chunk within 2-5s

**Request body:**
```json
{"chat_session_id": "...", "parent_message_id": null, "message": "Bajo vineyard elevation", "search_doc_ids": null, "retrieval_options": {"run_search": "always", "real_time": true}, "skip_gen_ai_answer_generation": true}
```

**Response format:** NDJSON stream (one JSON object per line).

**Event sequence observed:**
1. {"user_message_id": 8, "reserved_assistant_message_id": 9}
2. {"obj": {"type": "reasoning_start"}}
3. Multiple {"obj": {"type": "reasoning_delta", "reasoning": "..."}} events
4. {"obj": {"type": "reasoning_done"}}
5. {"obj": {"type": "search_tool_start", "is_internet_search": false}}
6. {"obj": {"type": "search_tool_queries_delta", "queries": ["Bajo vineyard elevation", "Bajo vineyard altitude", "Bajo vinedo elevacion"]}}
7. {"obj": {"type": "search_tool_documents_delta", "documents": [...]}}

**Top search result in stream:**
- semantic_identifier: the-grapes-vineyards_grapes_vineyards.md
- score: 0.8015
- match_highlight: "The Bajo vineyard is completely flat, at around 4,000 feet in elevation"

**Key finding:** Even with skip_gen_ai_answer_generation=true, Onyx still emits reasoning events. Claude extended thinking fires at the LLM provider level before retrieval and cannot be suppressed by this flag. The flag only skips final answer synthesis.

---

## Test 4: POST /api/manage/admin/connector/indexing-status

**Status:** PASS (previously 403; GET returns 405; POST returns 200)
**HTTP Code (GET):** 405 Method Not Allowed
**HTTP Code (POST):** 200
**Response Time (POST):** 0.522s
**Request body for POST:** {}

**Full response:**
```json
[{
  "source": "google_drive",
  "summary": {
    "total_connectors": 1,
    "active_connectors": 1,
    "public_connectors": 1,
    "total_docs_indexed": 33
  },
  "current_page": 1,
  "total_pages": 1,
  "indexing_statuses": [{
    "cc_pair_id": 2,
    "name": "BWC connnector",
    "source": "google_drive",
    "access_type": "public",
    "cc_pair_status": "ACTIVE",
    "in_progress": false,
    "in_repeated_error_state": false,
    "last_finished_status": "success",
    "last_status": "success",
    "last_success": "2026-03-02T11:22:02.194783Z",
    "is_editable": true,
    "docs_indexed": 33,
    "latest_index_attempt_docs_indexed": 0
  }]
}]
```

---

## Knowledge Base State

| Metric | Value |
|---|---|
| Connector name | BWC connnector (typo: three n) |
| Source | Google Drive |
| Status | ACTIVE |
| Total docs indexed | 33 |
| Last successful index | 2026-03-02T11:22:02Z (today) |
| In progress | false |
| Error state | false |

---

## Issues Found

1. **send-chat-message always streams despite stream=false** — Endpoint delivers its body as a streaming HTTP response regardless of the stream parameter. Callers must use max-time 60s minimum. A 30s timeout results in an empty body despite HTTP 200.

2. **create-chat-session intermittent latency (0.4s to 55s)** — Likely LLM provider cold-start on Onyx backend. Not a failure; use max-time 60s in integration code.

3. **indexing-status requires POST not GET** — Returns 405 on GET and 200 on POST. Any existing code using GET must be changed to POST.

4. **reasoning_delta events fire even with skip_gen_ai=true** — Claude extended thinking fires at the LLM provider level before retrieval. The skip_gen_ai_answer_generation flag only suppresses final answer synthesis, not the reasoning preamble or search phase.

5. **Connector name typo** — Named "BWC connnector" (three n). Cosmetic only; does not affect function.

---

## Recommendations

1. **Increase ONYX_SEARCH_TIMEOUT_MS** — Current value 15000ms is insufficient for chat endpoints. Set to 60000ms for send-chat-message and create-chat-session. The 15000ms value is fine for /api/admin/search only.

2. **Fix indexing-status HTTP method** — Change GET to POST in any code calling /api/manage/admin/connector/indexing-status.

3. **Prefer /api/admin/search for retrieval-only queries** — Fast (2.6s), ranked docs with highlights, no session management needed. Ideal for the article generation pipeline where Onyx retrieval feeds Claude API client-side.

4. **Use /api/chat/send-message with skip_gen_ai=true for streaming retrieval** — Delivers search results as stream events quickly (~5s first chunk). Best for workflows needing raw KB chunks without full LLM synthesis inside Onyx.

5. **Handle streaming body in all Onyx chat callers** — Do not use synchronous request/response patterns. All callers of /api/chat/send-chat-message must consume the response as a stream and wait for the full body before parsing JSON.
