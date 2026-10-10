// src/index.ts
import { createMcpHandler } from "agents/mcp/server";
import { realArtifacts } from "./artifacts";
import { Db } from "./db/db";
import type { Env } from "./env";
import { isPilot } from "./auth";
import { createServer } from "./mcp/server";
import { consume } from "./queue";
import { route } from "./router";
import { Armature } from "./service";
import { subscribeRepoPushes } from "./subscriptions";

export const buildApp = (env: Env): { armature: Armature; db: Db } => {
  const db = new Db(env.DB);
  const artifacts = env.ARTIFACTS ? realArtifacts(env.ARTIFACTS) : (globalThis as { __fakeArtifacts?: never }).__fakeArtifacts!;
  return { db, armature: new Armature(db, artifacts, (repo) => subscribeRepoPushes(env, repo), env.ARTIFACTS_NAMESPACE) };
};

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
  async queue(batch: MessageBatch, env: Env, _ctx: ExecutionContext): Promise<void> {
    const { armature, db } = buildApp(env);
    await consume(batch, armature, db);
  },
} satisfies ExportedHandler<Env>;
