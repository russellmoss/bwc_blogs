import { GoogleAuth } from "google-auth-library";

export function getGscAuth(): GoogleAuth {
  const credentialsJson = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!credentialsJson) throw new Error("GSC_SERVICE_ACCOUNT_JSON not set");

  const credentials = JSON.parse(credentialsJson);
  return new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}
