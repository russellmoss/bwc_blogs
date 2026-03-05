export type ActivityAction =
  | "LOGIN"
  | "PASSWORD_CHANGED"
  | "ARTICLE_FINALIZED"
  | "ARTICLE_PUBLISHED"
  | "USER_CREATED"
  | "USER_DEACTIVATED"
  | "USER_REACTIVATED"
  | "USER_PASSWORD_RESET";

export interface ActivityLogEntry {
  id: number;
  userId: number;
  userEmail: string;
  userName: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivityLogPage {
  entries: ActivityLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
