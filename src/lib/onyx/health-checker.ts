import { getOnyxConfig } from "./client";
import type { OnyxHealthStatus } from "@/types/onyx";

const HEALTH_TIMEOUT_MS = 5000;

export async function checkOnyxHealth(): Promise<OnyxHealthStatus> {
  const config = getOnyxConfig();
  const startTime = Date.now();

  try {
    // 1. Check API health
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    let healthOk = false;
    try {
      const healthRes = await fetch(`${config.baseUrl}/api/health`, {
        method: "GET",
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: controller.signal,
      });
      healthOk = healthRes.ok;
    } finally {
      clearTimeout(timer);
    }

    if (!healthOk) {
      return {
        healthy: false,
        indexedDocuments: null,
        lastIndexTime: null,
        responseTimeMs: Date.now() - startTime,
      };
    }

    // 2. Check indexing status
    let indexedDocuments: number | null = null;
    let lastIndexTime: string | null = null;

    const indexController = new AbortController();
    const indexTimer = setTimeout(
      () => indexController.abort(),
      HEALTH_TIMEOUT_MS
    );

    try {
      const indexRes = await fetch(
        `${config.baseUrl}/api/manage/admin/connector/indexing-status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({}),
          signal: indexController.signal,
        }
      );

      if (indexRes.ok) {
        const data = await indexRes.json();
        // Response is an array of source groups, each with summary and indexing_statuses
        const sources = Array.isArray(data) ? data : [];
        for (const sourceGroup of sources) {
          if (sourceGroup?.source === "google_drive") {
            indexedDocuments = sourceGroup?.summary?.total_docs_indexed ?? null;
            const statuses = sourceGroup?.indexing_statuses ?? [];
            if (statuses.length > 0) {
              lastIndexTime = statuses[0]?.last_success ?? null;
            }
            break;
          }
        }
      }
    } finally {
      clearTimeout(indexTimer);
    }

    return {
      healthy: true,
      indexedDocuments,
      lastIndexTime,
      responseTimeMs: Date.now() - startTime,
    };
  } catch {
    return {
      healthy: false,
      indexedDocuments: null,
      lastIndexTime: null,
      responseTimeMs: -1,
    };
  }
}
