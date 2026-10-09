// src/router.ts
import { isPilot, seatCookie } from "./auth";
import { actions } from "./cockpit/actions";
import { esc, page, redirect } from "./cockpit/html";
import { intentPage, loginPage, projectPage, projectsPage } from "./cockpit/pages";
import type { Env } from "./env";
import { type Armature, ServiceError } from "./service";
import { TransitionError } from "./model/intent";

type Handler = (armature: Armature, params: string[], request: Request, env: Env) => Promise<Response>;
interface Route { method: string; pattern: RegExp; handler: Handler; open?: boolean }

const html = (_title: string, body: string) => new Response(body, { headers: { "content-type": "text/html;charset=utf-8" } });
const json = (data: unknown, status = 200) => Response.json(data, { status });

const routes: Route[] = [
  { method: "GET", pattern: /^\/health$/, open: true, handler: async () => json({ ok: true }) },
  { method: "GET", pattern: /^\/login$/, open: true, handler: async () => new Response(loginPage(), { headers: { "content-type": "text/html;charset=utf-8" } }) },
  { method: "POST", pattern: /^\/login$/, open: true, handler: async (_a, _p, request, env) => {
    const token = String((await request.formData()).get("token") ?? "");
    const probe = new Request(request.url, { headers: { authorization: `Bearer ${token}` } });
    return isPilot(probe, env) ? redirect("/", { "set-cookie": seatCookie(token) }) : new Response("Wrong token", { status: 401 });
  } },
  { method: "GET", pattern: /^\/$/, handler: async (a) => html("Projects", projectsPage(await a.listProjects())) },
  { method: "POST", pattern: /^\/projects$/, handler: async (a, _p, request) => {
    const project = await a.createProject(String((await request.formData()).get("slug") ?? "").trim());
    return redirect(`/p/${project.slug}`);
  } },
  { method: "GET", pattern: /^\/p\/([^/]+)$/, handler: async (a, [slug]) => { const v = await a.projectView(slug); return v ? html(slug, projectPage(v)) : new Response("Not found", { status: 404 }); } },
  { method: "POST", pattern: /^\/p\/([^/]+)\/vision$/, handler: async (a, [slug], request) => actions.vision(a, slug, await request.formData()) },
  { method: "POST", pattern: /^\/p\/([^/]+)\/intents$/, handler: async (a, [slug], request) => actions.intent(a, slug, await request.formData()) },
  { method: "GET", pattern: /^\/i\/([^/]+)$/, handler: async (a, [id]) => { const v = await a.intentView(id); return v ? html(v.intent.title, intentPage(v)) : new Response("Not found", { status: 404 }); } },
  { method: "POST", pattern: /^\/i\/([^/]+)\/reply$/, handler: async (a, [id], r) => actions.reply(a, id, await r.formData()) },
  { method: "POST", pattern: /^\/i\/([^/]+)\/verdict$/, handler: async (a, [id], r) => actions.verdict(a, id, await r.formData()) },
  { method: "POST", pattern: /^\/i\/([^/]+)\/challenge$/, handler: async (a, [id], r) => actions.challenge(a, id, await r.formData()) },
  { method: "POST", pattern: /^\/i\/([^/]+)\/steer$/, handler: async (a, [id], r) => actions.steer(a, id, await r.formData()) },
  { method: "POST", pattern: /^\/i\/([^/]+)\/private$/, handler: async (a, [id], r) => actions.privacy(a, id, await r.formData()) },
  { method: "POST", pattern: /^\/i\/([^/]+)\/close$/, handler: async (a, [id]) => actions.close(a, id) },
  { method: "POST", pattern: /^\/i\/([^/]+)\/shelve$/, handler: async (a, [id]) => actions.shelve(a, id) },
  { method: "POST", pattern: /^\/i\/([^/]+)\/accept$/, handler: async (a, [id], r) => actions.accept(a, id, await r.formData()) },
  { method: "POST", pattern: /^\/i\/([^/]+)\/reject$/, handler: async (a, [id], r) => actions.reject(a, id, await r.formData()) },
  { method: "GET", pattern: /^\/api\/intent\/([^/]+)$/, handler: async (a, [id]) => { const v = await a.intentView(id); return v ? json(v) : json({ error: "no such intent" }, 404); } },
  { method: "GET", pattern: /^\/api\/intent\/([^/]+)\/export$/, handler: async (a, [id]) => json(await a.exportChapter(id)) },
];

export const route = async (request: Request, env: Env, armature: Armature): Promise<Response> => {
  const url = new URL(request.url);
  for (const r of routes) {
    if (r.method !== request.method) continue;
    const m = url.pathname.match(r.pattern);
    if (!m) continue;
    if (!r.open && !isPilot(request, env)) {
      return url.pathname.startsWith("/api/") || request.method !== "GET" ? new Response(null, { status: 401 }) : redirect("/login");
    }
    try {
      return await r.handler(armature, m.slice(1), request, env);
    } catch (error) {
      if (error instanceof ServiceError) return page("Refused", `<h1>Refused</h1><p>${esc(error.message)}</p><p><a href="javascript:history.back()">back</a></p>`, error.status);
      if (error instanceof TransitionError) return page("Refused", `<h1>Refused</h1><p>${esc(error.message)}</p>`, 409);
      throw error;
    }
  }
  return new Response("Not found", { status: 404 });
};
