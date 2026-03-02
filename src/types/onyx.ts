export interface OnyxSearchResult {
  documentId: string;
  content: string;
  sourceDocument: string; // Filename or document title
  score: number;
  metadata: Record<string, unknown>;
}

export interface OnyxContext {
  query: string;
  results: OnyxSearchResult[];
  totalResults: number;
  searchTimeMs: number;
}

export interface OnyxHealthStatus {
  healthy: boolean;
  indexedDocuments: number | null;
  lastIndexTime: string | null;
  responseTimeMs: number;
}
