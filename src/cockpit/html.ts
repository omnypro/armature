// src/cockpit/html.ts
export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const CSS = `
:root{color-scheme:light dark;--fg:#1a1a1a;--bg:#fff;--mute:#666;--line:#ddd;--mark:#ffe9a8}
@media(prefers-color-scheme:dark){:root{--fg:#eee;--bg:#111;--mute:#999;--line:#333;--mark:#4a3b00}}
body{font:15px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--fg);background:var(--bg);margin:0;padding:16px;max-width:1100px}
h1,h2,h3{font-weight:600;margin:1.2em 0 .4em}table{border-collapse:collapse;width:100%}
th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
pre{white-space:pre-wrap;word-break:break-word;background:rgba(127,127,127,.08);padding:8px;border-radius:4px}
textarea,input[type=text]{width:100%;font:inherit;padding:6px}button{font:inherit;padding:4px 10px}
.mute{color:var(--mute)}.note{color:var(--mute);font-size:13px}.ex{border-left:3px solid var(--line);padding-left:10px;margin:10px 0}
.ex.to_crew{border-color:#5b8def}.ex.poke{border-color:#e0a106}.reply{margin-left:16px}.private{background:var(--mark)}
form.inline{display:inline}.diff{font-size:13px}
`;

export const layout = (title: string, body: string): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Armature</title><style>${CSS}</style></head><body><p class="note"><a href="/">Armature</a></p>${body}</body></html>`;

export const page = (title: string, body: string, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(layout(title, body), { status, headers: { "content-type": "text/html;charset=utf-8", ...headers } });

export const redirect = (to: string, headers: Record<string, string> = {}): Response =>
  new Response(null, { status: 302, headers: { location: to, ...headers } });

export const verbatim = (s: string): string => `<pre>${esc(s)}</pre>`;
export const PUBLISHED = `<p class="note">published with the chapter</p>`;
