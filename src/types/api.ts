// Standard API response wrappers
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Error codes (from orchestration doc S10)
export type ErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "GENERATION_FAILED"
  | "ONYX_UNAVAILABLE"
  | "RENDER_ERROR"
  | "QA_GATE_FAILED"
  | "CLOUDINARY_ERROR"
  | "LINK_VERIFICATION_FAILED"
  | "INTERNAL_ERROR";

// Validation result returned by article schema validation
export interface ValidationResult {
  valid: boolean;
  errors: { path: string; message: string }[];
  warnings: string[];
}
