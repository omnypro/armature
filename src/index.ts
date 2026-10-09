import type { Env } from "./env";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }
    return new Response("Not found", { status: 404 });
  },
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const message of batch.messages) message.ack();
  },
} satisfies ExportedHandler<Env>;
