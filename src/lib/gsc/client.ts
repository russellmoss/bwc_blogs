import { google } from "googleapis";
import { getGscAuth } from "./auth";

export function getSearchConsoleClient() {
  const auth = getGscAuth();
  return google.searchconsole({ version: "v1", auth });
}
