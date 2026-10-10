-- migrations/0001_init.sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  vision TEXT NOT NULL DEFAULT '',
  namespace TEXT NOT NULL,
  repo TEXT NOT NULL,
  remote TEXT NOT NULL,
  subscription_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE intents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  seq INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open','closed','accepted','landed','shelved')),
  accepted_proposal_id TEXT,
  commit_ref TEXT,
  created_at TEXT NOT NULL,
  closed_at TEXT,
  accepted_at TEXT,
  landed_at TEXT,
  UNIQUE (project_id, seq)
);

CREATE TABLE exchanges (
  id TEXT PRIMARY KEY,
  intent_id TEXT NOT NULL REFERENCES intents(id),
  proposal_id TEXT,
  limb TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('to_pilot','to_crew')),
  kind TEXT NOT NULL CHECK (kind IN ('question','poke','challenge','steer','reply')),
  tag TEXT CHECK (tag IN ('heads_up','you_should_know')),
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  reply_to TEXT,
  taken INTEGER,
  private INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX exchanges_intent ON exchanges(intent_id, created_at);

CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  intent_id TEXT NOT NULL REFERENCES intents(id),
  limb TEXT NOT NULL,
  fork_repo TEXT NOT NULL,
  fork_remote TEXT NOT NULL,
  base_commit TEXT NOT NULL,
  commit_hash TEXT NOT NULL,
  paths TEXT NOT NULL,
  evidence TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open','accepted','rejected','superseded')),
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE INDEX proposals_intent ON proposals(intent_id, created_at);

CREATE TABLE forks (
  id TEXT PRIMARY KEY,
  intent_id TEXT NOT NULL REFERENCES intents(id),
  limb TEXT NOT NULL,
  fork_repo TEXT NOT NULL UNIQUE,
  fork_remote TEXT NOT NULL,
  base_commit TEXT NOT NULL,
  subscription_id TEXT,
  created_at TEXT NOT NULL,
  last_push_at TEXT
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id),
  kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX events_project ON events(project_id, id);

CREATE TABLE pushes (
  repo TEXT NOT NULL,
  after_hash TEXT NOT NULL,
  seen_at TEXT NOT NULL,
  PRIMARY KEY (repo, after_hash)
);
