import { getAccessToken, getProjectId } from "./drive-auth";
import { env } from "@/lib/env";

const MODEL_ID = "text-embedding-004";
const EMBEDDING_DIMENSION = 768;
const MAX_BATCH_SIZE = 250; // Vertex AI limit per request

export { EMBEDDING_DIMENSION };

/**
 * Embed a batch of texts using Vertex AI text-embedding-004.
 * Returns an array of 768-dimensional vectors.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const allEmbeddings: number[][] = [];

  // Process in batches to respect API limits
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const batchEmbeddings = await embedBatch(batch);
    allEmbeddings.push(...batchEmbeddings);
  }

  return allEmbeddings;
}

/**
 * Embed a single text. Convenience wrapper.
 */
export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

async function embedBatch(texts: string[]): Promise<number[][]> {
  const projectId = getProjectId();
  const location = env.VERTEX_AI_LOCATION || "us-central1";
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${MODEL_ID}:predict`;
  const body = JSON.stringify({
    instances: texts.map((text) => ({
      content: text,
      task_type: "RETRIEVAL_DOCUMENT",
    })),
    parameters: { outputDimensionality: EMBEDDING_DIMENSION },
  });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const token = await getAccessToken();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (response.ok) {
      const data = await response.json();
      const predictions = data.predictions as Array<{ embeddings: { values: number[] } }>;
      return predictions.map((p) => p.embeddings.values);
    }

    // Retry on transient errors
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
      console.warn(`[embedder] Retry ${attempt + 1}/${MAX_RETRIES} after ${response.status}`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      continue;
    }

    const errorText = await response.text();
    throw new Error(`Vertex AI embedding failed (${response.status}): ${errorText}`);
  }

  throw new Error("embedBatch: unreachable");
}

/**
 * Embed texts for search queries (uses RETRIEVAL_QUERY task type).
 */
export async function embedQuery(text: string): Promise<number[]> {
  const token = await getAccessToken();
  const projectId = getProjectId();
  const location = env.VERTEX_AI_LOCATION || "us-central1";

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${MODEL_ID}:predict`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ content: text, task_type: "RETRIEVAL_QUERY" }],
      parameters: {
        outputDimensionality: EMBEDDING_DIMENSION,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vertex AI query embedding failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.predictions[0].embeddings.values;
}
