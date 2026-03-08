function optionalEnv(name: string, defaultValue: string = ''): string {
  return (process.env[name] || defaultValue).trim();
}

export const env = {
  DATABASE_URL: optionalEnv('DATABASE_URL', ''),
  DIRECT_URL: optionalEnv('DIRECT_URL', ''),
  AUTH_SECRET: optionalEnv('AUTH_SECRET', ''),
  AUTH_URL: optionalEnv('AUTH_URL', 'http://localhost:3000'),
  ADMIN_EMAIL: optionalEnv('ADMIN_EMAIL', ''),
  ANTHROPIC_API_KEY: optionalEnv('ANTHROPIC_API_KEY', ''),
  ANTHROPIC_MODEL: optionalEnv('ANTHROPIC_MODEL', 'claude-sonnet-4-5-20250929'),
  ONYX_API_URL: optionalEnv('ONYX_API_URL', ''),
  ONYX_API_KEY: optionalEnv('ONYX_API_KEY', ''),
  ONYX_BASE_URL: optionalEnv('ONYX_BASE_URL', ''),
  ONYX_INDEX_NAME: optionalEnv('ONYX_INDEX_NAME', 'default'),
  ONYX_SEARCH_TIMEOUT_MS: optionalEnv('ONYX_SEARCH_TIMEOUT_MS', '10000'),
  CLOUDINARY_URL: optionalEnv('CLOUDINARY_URL', ''),
  CLOUDINARY_CLOUD_NAME: optionalEnv('CLOUDINARY_CLOUD_NAME', ''),
  CLOUDINARY_UPLOAD_PRESET: optionalEnv('CLOUDINARY_UPLOAD_PRESET', 'blog'),
  ANTHROPIC_SMALL_MODEL: optionalEnv('ANTHROPIC_SMALL_MODEL', 'claude-sonnet-4-5-20250929'),
  ANTHROPIC_MAX_OUTPUT_TOKENS: optionalEnv('ANTHROPIC_MAX_OUTPUT_TOKENS', '16384'),
  ENABLE_WEB_SEARCH: optionalEnv('ENABLE_WEB_SEARCH', 'true'),
  BWC_SITE_URL: optionalEnv('BWC_SITE_URL', 'https://www.bhutanwine.com'),
  CLOUDINARY_API_KEY: optionalEnv('CLOUDINARY_API_KEY', ''),
  CLOUDINARY_API_SECRET: optionalEnv('CLOUDINARY_API_SECRET', ''),
  GOOGLE_DRIVE_PHOTOS_FOLDER_URL: optionalEnv('GOOGLE_DRIVE_PHOTOS_FOLDER_URL', ''),
  GOOGLE_DRIVE_PHOTOS_FOLDER_ID: optionalEnv('GOOGLE_DRIVE_PHOTOS_FOLDER_ID', ''),
  GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY: optionalEnv('GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY', ''),
  RAG_PROVIDER: optionalEnv('RAG_PROVIDER', 'custom'),
  GOOGLE_DRIVE_DOCS_FOLDER_ID: optionalEnv('GOOGLE_DRIVE_DOCS_FOLDER_ID', ''),
  GOOGLE_DRIVE_DOCS_FOLDER_URL: optionalEnv('GOOGLE_DRIVE_DOCS_FOLDER_URL', ''),
  VERTEX_AI_LOCATION: optionalEnv('VERTEX_AI_LOCATION', 'us-central1'),
} as const;
