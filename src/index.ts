// src/index.ts
import { createMcpHandler } from "agents/mcp/server";
import { realArtifacts } from "./artifacts";
import { Db } from "./db/db";
import type { Env } from "./env";
import { isPilot } from "./auth";
import { createServer } from "./mcp/server";
import { route } from "./router";
import { Armature } from "./service";

// Subscriptions are wired in Task 13; until then project and fork pushes are not subscribed.
const noSubscription = async (_repo: string): Promise<string | null> => null;

export const buildApp = (env: Env): { armature: Armature } => ({
  armature: new Armature(new Db(env.DB), env.ARTIFACTS ? realArtifacts(env.ARTIFACTS) : (globalThis as { __fakeArtifacts?: never }).__fakeArtifacts!, noSubscription, env.ARTIFACTS_NAMESPACE),
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/mcp") {
      if (!isPilot(request, env)) return new Response(null, { status: 401 });
      const { armature } = buildApp(env);
      return createMcpHandler(() => createServer(armature), { route: "/mcp" })(request, env, ctx);
    }
    return route(request, env, buildApp(env).armature);
  },
  async queue(batch: MessageBatch, _env: Env): Promise<void> {
    for (const message of batch.messages) message.ack();
  },
} satisfies ExportedHandler<Env>;
