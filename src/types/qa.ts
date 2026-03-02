export type CheckSeverity = "fail" | "warn" | "info";

export interface QACheck {
  id: string; // "F1", "W3", etc.
  name: string; // "H1 present"
  severity: CheckSeverity;
  rule: string; // Human-readable rule description
  category: string; // "structure" | "metadata" | "links" | "images" | "schema" | "readability"
}

export interface QAResult {
  check: QACheck;
  passed: boolean;
  score: number; // 1 (pass), 0.5 (warn), 0 (fail)
  message: string; // "H1 found: 'Himalayan Terroir...'" or "H1 missing"
  elementPath: string | null; // CSS selector for highlight
  fixSuggestion: string | null; // Pre-populated fix prompt
}

export interface QAScore {
  total: number; // e.g. 48
  possible: number; // e.g. 52
  failCount: number;
  warnCount: number;
  passCount: number;
  results: QAResult[];
  canFinalize: boolean; // failCount === 0
}
