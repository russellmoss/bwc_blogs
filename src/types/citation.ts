import type { OnyxSearchResult } from "./onyx";

export interface CitationMatch {
  sectionId: string;
  nodeIndex: number;
  paragraphPlaintext: string;
  source: OnyxSearchResult;
  confidence: number; // trigram similarity 0-1
}
