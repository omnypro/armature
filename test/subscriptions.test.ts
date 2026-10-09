import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { subscribeRepoPushes } from "../src/subscriptions";

describe("subscribeRepoPushes", () => {
  it("posts the artifacts.repo source and returns the id", async () => {
    let seen: { url: string; body: string } | null = null;
    const fetchImpl: typeof fetch = async (input, init) => {
      seen = { url: String(input), body: String(init?.body) };
      return Response.json({ success: true, result: { id: "sub-123" } });
    };
    const id = await subscribeRepoPushes({ ...env, EVENTS_QUEUE_ID: "q-1", CF_ACCOUNT_ID: "acct" }, "demo", fetchImpl);
    expect(id).toBe("sub-123");
    expect(seen!.url).toBe("https://api.cloudflare.com/client/v4/accounts/acct/event_subscriptions/subscriptions");
    expect(JSON.parse(seen!.body)).toEqual({ name: "armature:demo", enabled: true, events: ["pushed"], source: { type: "artifacts.repo", namespace: "armature", repo_name: "demo" }, destination: { type: "queues.queue", queue_id: "q-1" } });
  });
  it("returns null and does not throw when the API fails", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls++;
      return Response.json({ success: false, errors: [{ message: "nope" }] }, { status: 400 });
    };
    expect(await subscribeRepoPushes({ ...env, EVENTS_QUEUE_ID: "q-1" }, "demo", fetchImpl)).toBeNull();
    expect(calls).toBe(1);
  });
  it("makes no network call when the queue id is empty", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls++;
      return Response.json({ success: true, result: { id: "sub-123" } });
    };
    expect(await subscribeRepoPushes({ ...env, EVENTS_QUEUE_ID: "" }, "demo", fetchImpl)).toBeNull();
    expect(calls).toBe(0);
  });
  it("returns null when fetch throws", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("boom");
    };
    expect(await subscribeRepoPushes({ ...env, EVENTS_QUEUE_ID: "q-1" }, "demo", fetchImpl)).toBeNull();
  });
  it("returns null on a non-JSON 502 body", async () => {
    const fetchImpl: typeof fetch = async () => new Response("<html>bad gateway</html>", { status: 502 });
    expect(await subscribeRepoPushes({ ...env, EVENTS_QUEUE_ID: "q-1" }, "demo", fetchImpl)).toBeNull();
  });
});
