// src/subscriptions.ts
import type { Env } from "./env";

export const subscribeRepoPushes = async (env: Env, repo: string, fetchImpl: typeof fetch = fetch): Promise<string | null> => {
  if (!env.CF_API_TOKEN || !env.EVENTS_QUEUE_ID) return null;
  try {
    const res = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/event_subscriptions/subscriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.CF_API_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({
        name: `armature:${repo}`, enabled: true, events: ["pushed"],
        source: { type: "artifacts.repo", namespace: env.ARTIFACTS_NAMESPACE, repo_name: repo },
        destination: { type: "queues.queue", queue_id: env.EVENTS_QUEUE_ID },
      }),
    });
    const body = (await res.json()) as { success?: boolean; result?: { id?: string }; errors?: { message: string }[] };
    if (!res.ok || !body.success || !body.result?.id) {
      console.warn("subscription failed", repo, res.status, JSON.stringify(body.errors ?? []));
      return null;
    }
    return body.result.id;
  } catch (error) {
    console.warn("subscription errored", repo, error instanceof Error ? error.message : String(error));
    return null;
  }
};
