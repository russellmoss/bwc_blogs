import { GoogleAuth } from "google-auth-library";
import { env } from "@/lib/env";

let cachedAuth: GoogleAuth | null = null;

/**
 * Returns a GoogleAuth instance using the Drive service account key.
 * Scoped for both Drive API and Vertex AI embeddings.
 */
export function getDriveAuth(): GoogleAuth {
  if (cachedAuth) return cachedAuth;

  const credentialsJson = env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  if (!credentialsJson) {
    throw new Error("GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY not set");
  }

  const credentials = JSON.parse(credentialsJson);
  cachedAuth = new GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/cloud-platform",
    ],
  });

  return cachedAuth;
}

/**
 * Get an access token for API calls.
 */
export async function getAccessToken(): Promise<string> {
  const auth = getDriveAuth();
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse.token;
  if (!token) throw new Error("Failed to obtain access token");
  return token;
}

/**
 * Get the GCP project ID from the service account credentials.
 */
export function getProjectId(): string {
  const credentialsJson = env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  if (!credentialsJson) throw new Error("GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY not set");
  const credentials = JSON.parse(credentialsJson);
  return credentials.project_id;
}
