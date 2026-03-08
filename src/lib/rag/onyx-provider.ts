import { searchOnyx, searchOnyxMulti } from "@/lib/onyx";
import { checkOnyxHealth } from "@/lib/onyx";
import type { OnyxContext, OnyxHealthStatus } from "@/types/onyx";
import type { RagProvider } from "@/types/rag";

export class OnyxProvider implements RagProvider {
  readonly type = "onyx" as const;

  async search(query: string): Promise<OnyxContext> {
    return searchOnyx(query);
  }

  async searchMulti(queries: string[]): Promise<OnyxContext[]> {
    return searchOnyxMulti(queries);
  }

  async health(): Promise<OnyxHealthStatus> {
    return checkOnyxHealth();
  }
}
