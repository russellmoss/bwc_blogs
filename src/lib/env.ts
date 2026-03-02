function optionalEnv(name: string, defaultValue: string = ''): string {
  return process.env[name] || defaultValue;
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
  BWC_SITE_URL: optionalEnv('BWC_SITE_URL', 'https://www.bhutanwine.com'),
} as const;
