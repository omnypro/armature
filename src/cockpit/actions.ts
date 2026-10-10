// src/cockpit/actions.ts
import type { Armature } from "../service";
import { redirect } from "./html";

const field = (f: FormData, k: string): string => String(f.get(k) ?? "").trim();

export const actions = {
  async vision(a: Armature, slug: string, f: FormData): Promise<Response> {
    const view = await a.projectView(slug);
    if (!view) return new Response("Not found", { status: 404 });
    await a.setVision(view.project.id, String(f.get("vision") ?? ""));
    return redirect(`/p/${slug}`);
  },
  async intent(a: Armature, slug: string, f: FormData): Promise<Response> {
    const view = await a.projectView(slug);
    if (!view) return new Response("Not found", { status: 404 });
    const intent = await a.createIntent(view.project.id, field(f, "title"), String(f.get("body") ?? ""));
    return redirect(`/i/${intent.id}`);
  },
  async reply(a: Armature, id: string, f: FormData): Promise<Response> {
    await a.fileExchange({ intentId: id, kind: "reply", body: field(f, "body"), author: "pilot", replyTo: field(f, "reply_to") });
    return redirect(`/i/${id}`);
  },
  async verdict(a: Armature, id: string, f: FormData): Promise<Response> {
    await a.setTaken(field(f, "exchange_id"), field(f, "taken") === "yes", field(f, "reason"));
    return redirect(`/i/${id}`);
  },
  async challenge(a: Armature, id: string, f: FormData): Promise<Response> {
    await a.fileExchange({ intentId: id, kind: "challenge", body: field(f, "body"), author: "pilot", proposalId: field(f, "proposal_id") });
    return redirect(`/i/${id}`);
  },
  async steer(a: Armature, id: string, f: FormData): Promise<Response> {
    await a.fileExchange({ intentId: id, kind: "steer", body: field(f, "body"), author: "pilot", limb: field(f, "limb") });
    return redirect(`/i/${id}`);
  },
  async privacy(a: Armature, id: string, f: FormData): Promise<Response> {
    await a.setPrivate(field(f, "exchange_id"), field(f, "private") === "yes");
    return redirect(`/i/${id}`);
  },
  async close(a: Armature, id: string): Promise<Response> { await a.closeChallenge(id); return redirect(`/i/${id}`); },
  async shelve(a: Armature, id: string): Promise<Response> { await a.shelve(id); return redirect(`/i/${id}`); },
  async accept(a: Armature, id: string, f: FormData): Promise<Response> { await a.accept(id, field(f, "proposal_id")); return redirect(`/i/${id}`); },
  async reject(a: Armature, id: string, f: FormData): Promise<Response> { await a.reject(field(f, "proposal_id")); return redirect(`/i/${id}`); },
  async verify(a: Armature, id: string): Promise<Response> { await a.verifyLanding(id); return redirect(`/i/${id}`); },
};
