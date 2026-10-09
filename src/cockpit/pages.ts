// src/cockpit/pages.ts
import type { IntentView, ProjectView } from "../service";
import type { Exchange, Project } from "../types";
import { PUBLISHED, esc, layout, verbatim } from "./html";

export const loginPage = (): string =>
  layout("Seat", `<h1>Take the seat</h1><form method="post" action="/login"><input type="text" name="token" placeholder="pilot token" autofocus> <button>Enter</button></form>`);

export const projectsPage = (projects: Project[]): string =>
  layout("Projects", `<h1>Projects</h1><ul>${projects.map((p) => `<li><a href="/p/${esc(p.slug)}">${esc(p.slug)}</a></li>`).join("")}</ul>
<h2>New project</h2><form method="post" action="/projects"><input type="text" name="slug" placeholder="slug"> <button>Create the repo</button></form>`);

export const projectPage = (v: ProjectView): string => {
  const p = v.project;
  const rows = v.intents.map((r) => `<tr><td>${r.intent.seq}</td><td><a href="/i/${r.intent.id}">${esc(r.intent.title)}</a></td><td>${r.intent.state}</td><td>${r.unanswered}</td><td>${r.openPokes}</td><td>${r.limbs.map(esc).join(", ")}</td><td>${r.openProposals}</td><td>${r.overlaps}</td><td>${r.intent.commit_ref ? r.intent.commit_ref.slice(0, 12) : ""}</td></tr>`).join("");
  return layout(p.slug, `<h1>${esc(p.slug)}</h1><p class="note">${esc(p.remote)}${p.subscription_id ? "" : " · <strong>landing cannot be verified: no push subscription on the project repo</strong>"}</p>
<h2>Blueprint</h2>${PUBLISHED}<form method="post" action="/p/${esc(p.slug)}/vision"><textarea name="vision" rows="8">${esc(p.vision)}</textarea><br><button>Save the vision</button></form>
<h2>Doctrine</h2>${v.doctrine === null ? `<p class="mute">No ARMATURE.md on main yet.</p>` : verbatim(v.doctrine)}
<h2>Intents</h2><table><tr><th>#</th><th>title</th><th>state</th><th>unanswered</th><th>open pokes</th><th>limbs</th><th>open proposals</th><th>overlaps</th><th>landed</th></tr>${rows}</table>
<h3>New intent</h3>${PUBLISHED}<form method="post" action="/p/${esc(p.slug)}/intents"><input type="text" name="title" placeholder="title"><br><textarea name="body" rows="10" placeholder="what you want next, in your words"></textarea><br><button>File the intent</button></form>
<h2>Memoir</h2>${v.chapters.length === 0 ? `<p class="mute">No chapters have landed.</p>` : `<ul>${v.chapters.map((c) => `<li>memoir/${esc(c)}</li>`).join("")}</ul>`}`);
};

const exchangeHtml = (e: Exchange, all: Exchange[], intentId: string, depth = 0): string => {
  const replies = all.filter((r) => r.kind === "reply" && r.reply_to === e.id);
  const head = e.kind === "poke" ? `poke (${e.tag})` : e.kind;
  const verdict = e.kind === "poke" && e.taken === null
    ? `<form class="inline" method="post" action="/i/${intentId}/verdict"><input type="hidden" name="exchange_id" value="${e.id}"><input type="text" name="reason" placeholder="reason (optional)"> <button name="taken" value="yes">Take</button> <button name="taken" value="no">Dismiss</button></form>`
    : e.kind === "poke" ? `<span class="mute">${e.taken ? "taken" : "dismissed"}</span>` : "";
  const privacy = `<form class="inline" method="post" action="/i/${intentId}/private"><input type="hidden" name="exchange_id" value="${e.id}"><button name="private" value="${e.private ? "no" : "yes"}">${e.private ? "make public" : "make private"}</button></form>`;
  const reply = `<form class="inline" method="post" action="/i/${intentId}/reply"><input type="hidden" name="reply_to" value="${e.id}"><input type="text" name="body" placeholder="reply"> <button>Reply</button></form>`;
  return `<div class="ex ${e.direction} ${e.kind}${e.private ? " private" : ""}${depth ? " reply" : ""}"><p class="note">${head} · ${esc(e.author)} · ${e.direction === "to_pilot" ? "to the pilot" : e.limb ? `to ${esc(e.limb)}` : "to the crew"} · ${e.created_at}${e.private ? " · private" : ""}</p>${verbatim(e.body)}<p>${verdict} ${privacy} ${depth < 2 ? reply : ""}</p>${replies.map((r) => exchangeHtml(r, all, intentId, depth + 1)).join("")}</div>`;
};

export const intentPage = (v: IntentView): string => {
  const i = v.intent;
  const roots = v.exchanges.filter((e) => e.kind !== "reply");
  const limbs = v.forks.map((f) => f.limb);
  const steer = limbs.length === 0 ? "" : `<form method="post" action="/i/${i.id}/steer"><select name="limb">${limbs.map((l) => `<option>${esc(l)}</option>`).join("")}</select> <input type="text" name="body" placeholder="steer this limb"> <button>Steer</button></form>`;
  const forks = v.forks.map((f) => `<tr><td>${esc(f.limb)}</td><td>${esc(f.fork_repo)}</td><td>${f.base_commit.slice(0, 12)}</td><td>${f.last_push_at ?? ""}</td></tr>`).join("");
  const proposals = v.proposals.map(({ proposal: p, blocking, overlaps, diffs }) => `<h3>${esc(p.limb)} · ${p.commit.slice(0, 12)} · ${p.state}</h3>
<p class="note">paths: ${p.paths.map(esc).join(", ")}${overlaps.length ? ` · <strong>overlaps ${overlaps.map((o) => o.paths.join(", ")).map(esc).join("; ")}</strong>` : ""}${blocking.length ? ` · <strong>${blocking.length} challenge${blocking.length === 1 ? "" : "s"} awaiting ${esc(p.limb)}</strong>` : ""}</p>
<h4>Evidence</h4>${verbatim(p.evidence)}
${diffs.map((d) => `<h4>${esc(d.path)}</h4><pre class="diff">${esc(d.diff)}</pre>`).join("")}
${p.state === "open" ? `<form class="inline" method="post" action="/i/${i.id}/challenge"><input type="hidden" name="proposal_id" value="${p.id}"><input type="text" name="body" placeholder="challenge this proposal"> <button>Challenge</button></form>
<form class="inline" method="post" action="/i/${i.id}/accept"><input type="hidden" name="proposal_id" value="${p.id}"><button ${i.state !== "closed" || blocking.length ? "disabled" : ""}>Accept</button></form>
<form class="inline" method="post" action="/i/${i.id}/reject"><input type="hidden" name="proposal_id" value="${p.id}"><button>Reject</button></form>` : ""}`).join("");
  return layout(i.title, `<p class="note"><a href="/p/${esc(v.project.slug)}">${esc(v.project.slug)}</a> · chapter ${i.seq} · ${i.state}${i.commit_ref ? ` · landed ${i.commit_ref.slice(0, 12)}` : ""}</p>
<h1>${esc(i.title)}</h1>${PUBLISHED}${verbatim(i.body)}
<p>${v.unanswered.length} unanswered · ${v.openPokes.length} open poke${v.openPokes.length === 1 ? "" : "s"}
${i.state === "open" ? `<form class="inline" method="post" action="/i/${i.id}/close"><button>Close the challenge</button></form>` : ""}
${i.state === "open" || i.state === "closed" ? `<form class="inline" method="post" action="/i/${i.id}/shelve"><button>Shelve</button></form>` : ""}
${i.state === "accepted" ? `<span class="mute">accepted; run <code>bin/land ${esc(v.project.slug)} ${i.id}</code> to land it</span>` : ""}</p>
<h2>Exchanges</h2>${roots.map((e) => exchangeHtml(e, v.exchanges, i.id)).join("") || `<p class="mute">Nothing yet.</p>`}${steer}
<h2>Forks</h2><table><tr><th>limb</th><th>repo</th><th>base</th><th>last push</th></tr>${forks}</table>
<h2>Proposals</h2>${proposals || `<p class="mute">None filed.</p>`}`);
};
