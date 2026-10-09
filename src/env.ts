import type { D1Migration } from "cloudflare:test";

export interface Env {
  ARTIFACTS: Artifacts;
  DB: D1Database;
  PILOT_TOKEN: string;
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  EVENTS_QUEUE_ID: string;
  ARTIFACTS_NAMESPACE: string;
  TEST_MIGRATIONS?: D1Migration[];
}
