# Armature: design

Written 2026-10-09 from the workshop in `omnyist/.claude/WORKSHOP-2026-10-09.md`.
Entry for Cloudflare's "Build the next Git platform" competition (deadline
2026-10-14, 11:59 PM PDT), and a tool Bryan keeps afterwards. The tool comes
first; the entry is whatever the tool is on the deadline.

## 1. What Armature is

Armature is a Git platform for one builder and their crew of agents. The
builder (the pilot) states what they want in their own words. The crew
challenges it before anyone writes code. Each agent (a limb) works on its own
fork and files proposals with evidence. The pilot reads the diff, argues
back, steers mid-flight, and decides what lands. Everything said along the
way is kept, in the repository, as the project's memoir.

Three claims, in the order the rubric scores them:

- **Intent before code.** The unit of work is an intent, not a pull request,
  and the first thing that happens to it is a challenge, not a build.
- **The crew is one brain because the repo carries its memory.** No limb
  holds its own version of the truth. A limb starting chapter five reads
  chapters one to four first. That is how it avoids asking what chapter two
  already answered.
- **The pilot is a peer, not a client.** The challenge runs both ways. The
  pilot holds a write token to every fork, reads diffs, and can pick up the
  work by hand. The platform assumes someone who knows what they are doing.

Ethos, from Omnyist Productions, verbatim in the README: "we build stuff for
ourselves and hope you like it too." Tagline: software memoirs.

Armature is Armature's first project. Its own memoir starts with the vision
written on 2026-10-09 and is the demo.

## 2. Who it is for, and who it is not for

For a builder who has the vision and reads code, and wants a crew that pushes
back. Single seat: one pilot, one namespace, one cockpit. Another builder
runs their own Armature; there is no shared hangar.

Not for someone who wants to type a sentence and receive a product. The
cockpit shows diffs, not summaries. The README says this in one sentence.

The crew's quality is the pilot's responsibility. Armature runs no model. It
serves context to whatever agents the pilot flies and records what they say.
A weak crew gives a thin memoir, and the platform cannot fix that.

## 3. The loop

1. **Vision.** The pilot writes the project's vision once, in their words,
   any length. The crew never rewrites it.
2. **Intent.** The pilot writes a chapter: what they want next, any length.
   Intents are numbered in order; the sequence is the plot.
3. **Challenge.** The crew files questions on the intent. The pilot answers.
   The pilot may close the challenge at any time; every unanswered question
   stays in the record as unanswered, forever. The gate is the memoir, not a
   lock.
4. **Build.** Each limb requests a fork of the project repo and a write
   token, reads the vision, the doctrine and the earlier chapters, and
   works. The watcher runs the whole time and files pokes. The pilot can
   steer a limb mid-flight, challenge anything, or commit on a fork directly.
5. **Propose.** A limb pushes to its fork and files a proposal: commit,
   touched paths, evidence. Armature flags overlaps between open proposals.
6. **Review.** The crew reviews proposals and files pokes. The pilot reads
   the diff and may challenge the limb; a challenge must be answered before
   the proposal can be accepted.
7. **Decide.** The pilot accepts one proposal or rejects it. Accept marks the
   intent accepted and names the commit.
8. **Land.** A limb (or the pilot) runs `bin/land` on their machine: it
   fetches the accepted commit, exports the chapter from the cockpit into
   `memoir/`, commits it on top, and pushes the project's `main`. The push
   event reaches Armature, which verifies the accepted commit is an ancestor
   of the new head and marks the intent landed with its commit ref. Workers
   Builds deploys `main`.

## 4. Objects

Live state is in D1 while an intent is in flight. A landed chapter is
exported into the project repository as files, which is the memoir. The
repository is the durable copy; D1 is the index and the in-flight record.

### Pilot

One per deployment in v1. Authenticated by a single bearer token stored as a
Worker secret. The cockpit sets an HttpOnly cookie after the token is
entered once; MCP calls carry the token as `Authorization: Bearer`.

### Project

| field | notes |
|---|---|
| `id`, `slug` | slug is the Artifacts repo name inside the pilot's namespace |
| `vision` | the pilot's words, any length; editable by the pilot only |
| `namespace`, `repo`, `remote` | from Artifacts |
| `doctrine_path` | `ARMATURE.md` at the repo root, read from `main` |
| `created_at` | |

`ARMATURE.md` is the pilot's standing rules for the crew (house style, what
to never do, how to write evidence). Armature serves it to every limb with the
project; it does not interpret it.

### Intent

| field | notes |
|---|---|
| `id`, `project_id`, `seq` | `seq` numbers chapters from 1 |
| `title` | one line, pilot's words |
| `body` | the intent, pilot's words, any length |
| `state` | `open`, `closed`, `accepted`, `landed`, `shelved` |
| `accepted_proposal_id` | set on accept |
| `commit_ref` | set on land |
| `created_at`, `closed_at`, `accepted_at`, `landed_at` | |

Transitions: `open → closed` (pilot closes the challenge), `closed →
accepted` (pilot accepts a proposal), `accepted → landed` (push event
verified), `open|closed → shelved` (pilot). No other transitions.

### Exchange

One shape for everything said about an intent, in either direction.

| field | notes |
|---|---|
| `id`, `intent_id` | |
| `proposal_id` | optional; set when the exchange is about a proposal |
| `limb` | optional; set when addressed to or filed by a specific limb |
| `direction` | `to_pilot` or `to_crew` |
| `kind` | `question`, `poke`, `challenge`, `steer`, `reply` |
| `tag` | pokes only: `heads_up` or `you_should_know` |
| `author` | `pilot`, a limb name, `watcher`, or `armature` |
| `body` | |
| `reply_to` | for `reply`: the exchange being answered |
| `taken` | pokes only, set by the pilot: `true`, `false`, or null |
| `created_at` | |

Rules:

- `question` and `poke` are `to_pilot`. `challenge` and `steer` are
  `to_crew`. `reply` takes the opposite direction of what it answers.
- A question is unanswered while no `reply` from the pilot points at it.
- A `challenge` on a proposal blocks accepting that proposal until a `reply`
  from the limb points at it. Nothing blocks the pilot.
- A `poke` the pilot marks `taken: false` carries the pilot's reason in a
  `reply`.
- Overlap pokes are filed by Armature itself with `author: armature` and
  `tag: heads_up` (see Proposals). All other pokes come from the crew.

### Proposal

| field | notes |
|---|---|
| `id`, `intent_id`, `limb` | |
| `fork_repo`, `fork_remote` | the limb's Artifacts fork |
| `base_commit` | project `main` at fork time |
| `commit` | the proposed head on the fork |
| `paths` | touched paths, reported by the limb from `git diff --name-only base..commit` |
| `evidence` | markdown: what was run, what it showed |
| `state` | `open`, `accepted`, `rejected`, `superseded` |
| `created_at`, `decided_at` | |

Overlap: when a proposal is filed, Armature intersects its `paths` with every
other open proposal in the project. A non-empty intersection files one
overlap poke on each affected intent naming the two proposals and the shared
paths. The pilot decides which lands; the other limb rebases its fork and
files a new proposal, which supersedes the old one.

### Fork

Recorded on the intent as the limb's workspace: `limb`, `fork_repo`,
`fork_remote`, `base_commit`, `created_at`, `last_push_at`. One fork per
limb per intent. The fork name is `<project>--<seq>--<limb>`.

## 5. The memoir in the repository

Exported at landing by `bin/land` through the `memoir.export` MCP call. The
export is deterministic from the D1 record, so re-running it is harmless.

```
ARMATURE.md
memoir/
  vision.md                  # current vision, pilot's words
  0001-<slug>/
    intent.md                # frontmatter: seq, title, state, dates, commit
    exchanges.md             # every exchange in order, with direction, kind,
                             # author, tag, answer or "unanswered"
    proposals.md             # every proposal, its evidence, its fate
```

`vision.md` is re-exported on every landing so edits to the vision travel
with the next chapter. Chapters are append-only; a landed chapter is never
rewritten. Shelved intents are exported too, marked shelved, on the next
landing.

A limb reads the memoir from the repo (`project.get` returns the chapter
index and `readFile` on `main` serves any chapter) and the in-flight intent
from D1 (`intent.get`). That is the "connected brain": the context is in the
clone, and any agent that can read a repo can read it without the cockpit.

## 6. The crew

Agents the pilot runs on their own machine. Armature ships role prompts as
plain markdown in `crew/`; they are written to work as Claude Code skills and
to be readable by any agent.

- **Challenger** (`crew/challenger.md`): reads the vision, the doctrine and
  every earlier chapter, then files questions on the open intent. Hard
  questions, the things the pilot did not think of, trade-offs. Never
  rewrites the intent.
- **Builder** (`crew/builder.md`): requests a fork, reads the same context,
  does the work, pushes, files a proposal with evidence and touched paths.
  Answers the pilot's challenges. Picks up steers from the change feed.
- **Watcher** (`crew/watcher.md`): polls `changes.since` on a loop. Files
  pokes tagged `heads_up` (something the pilot will want to know now) or
  `you_should_know` (something that changes a decision). One sentence, with
  the evidence attached. No lectures.

Tone bar for the whole crew, from the pilot: competent and dry. Never cute,
never nagging.

The challenge round is what the memoir is mostly made of, so the challenger
prompt is held to the bar "would the pilot read this again in six months."

## 7. Architecture on Cloudflare

One Worker, TypeScript, plain `fetch` handler with a small router and a
`queue` handler. No framework. Server-rendered HTML for the cockpit, one
stylesheet, no client build. Bun for scripts and tests.

| piece | what it does |
|---|---|
| **Artifacts binding** (`env.ARTIFACTS`, namespace per pilot) | create the project repo, fork per limb, mint repo-scoped tokens, `readFile` on any ref for doctrine, memoir chapters and diffs |
| **D1** (`env.DB`) | pilot, project, intent, exchange, proposal, fork, and an events table that feeds `changes.since` |
| **Queue** (`env.EVENTS`) | consumer for Artifacts event subscriptions: `pushed` on the project repo verifies landings; `pushed` on forks updates `last_push_at` |
| **Workers Builds** | connected in the dashboard to the project repo; `main` deploys, other branches preview |
| **MCP** (`/mcp`) | Streamable HTTP via `createMcpHandler` from the `agents` package, stateless, bearer auth |
| **Cockpit** (`/`) | the pilot's pages |
| **Secret** `PILOT_TOKEN` | the single seat |

Event subscriptions: the project repo's `pushed` subscription is created at
project creation through the Cloudflare REST API (repo-level subscriptions
need `namespace` and `repo_name`). Each fork gets its own subscription at
fork time, best effort: if creating it fails, Armature logs it and relies on
the limb's `proposal.file` call, which carries the commit anyway. Landing
verification needs the project repo's subscription and fails loudly in the
cockpit if that subscription is missing.

The diff view reads both versions of each touched path via `readFile` at
`base_commit` and at `commit`, and renders a unified diff in the Worker with
the `diff` package. Binary or missing files show as added or removed.

No model runs in the Worker. The only automatic judgment Armature makes is
the deterministic overlap check.

## 8. The MCP surface

All tools take and return JSON. Errors return `isError` with a plain message.

| tool | who calls it | does |
|---|---|---|
| `project.get(slug)` | any limb | vision, doctrine text, intents summary, memoir chapter index |
| `intent.list(slug, state?)` | any limb | intents in order |
| `intent.get(id)` | any limb | full record: body, exchanges, proposals, forks, overlaps |
| `exchange.file(intent_id, kind, body, tag?, proposal_id?, reply_to?, limb?)` | crew | file `question`, `poke`, or `reply`; direction set by Armature from the kind |
| `fork.request(intent_id, limb)` | builder | fork the project repo, mint a write token, record the fork, create its push subscription best effort; returns `remote`, `token`, `base_commit` |
| `proposal.file(intent_id, limb, commit, paths, evidence)` | builder | record the proposal, run the overlap check |
| `memoir.export(intent_id)` | `bin/land` | the chapter's three files as text, plus `vision.md` |
| `changes.since(slug, cursor)` | watcher | events after the cursor: intent state changes, exchanges filed, proposals filed, overlaps found, landings |

Pilot actions are HTTP form posts on the cockpit, not MCP: create project,
edit vision, write intent, reply to a question, take or dismiss a poke with
a reason, challenge a proposal, steer a limb, close the challenge, accept or
reject a proposal, shelve an intent.

## 9. The cockpit

Two pages and a login.

**Project page.** The vision at the top. Then one table, rows are intents in
order, columns: seq, title, state, unanswered questions, open pokes, limbs on
forks, open proposals, overlaps, landed commit. Nothing summarised; counts
link to the rows that make them.

**Intent page.** The body. Then every exchange in order with its direction,
kind, author and tag, replies nested one level. Then forks: limb, base,
commits since base, touched paths, last push, open steers. Then proposals:
limb, commit, paths, evidence, the diff per path, overlaps with other
proposals, and the accept and reject controls. Pilot controls sit inline:
reply, take or dismiss, challenge, steer, close, accept, reject, shelve.

The cockpit assumes the pilot reads code. The diff is the proposal.

## 10. Landing

`bin/land <project> <intent-id>` is a POSIX shell script in the Armature
repo, run on the pilot's machine or by a limb. It:

1. reads the intent from the cockpit API and refuses unless state is
   `accepted`;
2. fetches the accepted commit from the fork;
3. checks the project's `main` is an ancestor of the accepted commit, and
   refuses with instructions to rebase otherwise;
4. calls `memoir.export` and writes `memoir/vision.md` and
   `memoir/NNNN-slug/*`;
5. commits them on top of the accepted commit with the message
   `Land intent NNNN: <title>.`;
6. pushes to the project repo's `main`, and to a GitHub mirror remote if one
   is configured.

The push event marks the intent landed. Armature's own repo mirrors to
`github.com/omnypro/armature` because judges need a public URL and Artifacts
repos are private.

## 11. Error handling

- Artifacts calls that fail surface as a flagged row in the cockpit with the
  error text; nothing retries silently.
- Queue consumer is idempotent on `(repo, after)`; duplicate deliveries are
  no-ops.
- A landing push whose head does not descend from the accepted commit is
  recorded as a stray push on the intent and does not change state.
- Missing project-repo subscription: the intent page shows "landing cannot
  be verified" with the REST call to create it.
- MCP tool errors are plain messages; the crew prompts tell limbs to put the
  error in an exchange rather than retry blindly.

## 12. Testing

- `bun test` for the pure modules in `src/model/`: intent and proposal state
  machines, exchange rules (unanswered, blocking challenge), overlap check,
  memoir export rendering, diff rendering.
- `vitest` with `@cloudflare/vitest-pool-workers` for routes, D1 migrations
  and queries, the queue consumer, and the MCP tools, with the Artifacts
  binding behind a small interface and a fake implementation in tests.
- `bun run test` runs both. Nothing is reported as passing without that
  command's output.

Local development uses the Artifacts binding with `remote: true`.

## 13. Repository layout

```
armature/
  LICENSE                      MIT, Omnyist Productions, LLC
  README.md                    ethos line, what it is, who it is not for, run instructions
  ARMATURE.md                  Armature's own doctrine
  wrangler.jsonc
  package.json
  src/
    index.ts                   fetch router and queue handler
    cockpit/                   page rendering
    mcp/                       tools
    model/                     pure logic
    db/                        D1 queries and migrations/
  crew/
    challenger.md  builder.md  watcher.md
  bin/
    land
  memoir/                      Armature's own chapters, exported
  docs/superpowers/specs/      this document
```

Public repository. Commits are one line, plain, ending with a period, in
Bryan's voice.

## 14. Scope for the entry

On camera on 2026-10-14, all of it real, none of it staged:

- the vision and the first chapters of Armature's own memoir, written during
  the build;
- a challenge round with real questions and real answers;
- at least two limbs on two forks at once, on screen;
- a watcher poke that changes a proposal;
- an overlap flagged between two proposals;
- the pilot challenging a proposal and the limb answering;
- the diff, read in the cockpit;
- accept, land, the push event marking it landed, Workers Builds deploying.

Not in v1, promised in the README: multi-pilot sign-up, auth beyond the
single token, jurisdictions, metrics, a stranger contribution path. Artifacts
namespaces make multi-pilot true by construction, so the promise is honest.

Content rules from the official terms: no third-party names or artwork in
the product or the video, no attacks on any product, no political content.
The video is a file upload, MP4 or WebM or MOV, 2 GiB max.

## 15. Decisions made by the arbiter on the pilot's behalf

Listed so they can be vetoed in one line each.

- Plain `fetch` handler, no framework; server-rendered cockpit, no client
  build.
- `createMcpHandler` from `agents` for MCP, stateless.
- D1 for in-flight state; the repo for landed chapters.
- Overlap detection from limb-reported paths, not from the binding.
- Landing done by a script on the pilot's machine, because the binding
  cannot push.
- Role names in the product are plain: challenger, builder, watcher.
- Name: Armature. Tagline: software memoirs.

## 16. Cost

Workers Paid is already in place. Artifacts includes the first 10,000
operations and 1 GB per month, then $0.15 per 1,000 operations and $0.50 per
GB-month; billing starts 2026-10-14 by the docs. D1 and Queues are within the
plan's included usage at this scale. No metered model spend anywhere.
