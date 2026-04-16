# track-workout-api

Sync server for [Track Workout](https://github.com/blaine-2050/track-workout-core). Receives workout events from platform clients (iOS first), persists to MySQL on Railway.

**Behavior spec:** [`track-workout-core`](https://github.com/blaine-2050/track-workout-core) — wire format, data model, and conflict semantics live there. This repo is the implementation.

## Stack

Node ≥20, TypeScript, Express, Drizzle ORM, MySQL (Railway shared instance, `tw_` prefix), Vitest + in-memory SQLite for tests.

## Quick start (local, SQLite)

```bash
npm install
cp .env.example .env       # then set API_KEY
echo 'API_KEY=dev-key' >> .env
echo 'DATABASE_URL=local.db' >> .env
echo 'DB_DIALECT=sqlite' >> .env
npm run dev
```

Server runs on `http://localhost:3000`.

```bash
curl http://localhost:3000/health
curl http://localhost:3000/moves -H "Authorization: Bearer dev-key"
```

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET`  | `/health` | none | Railway healthcheck. Returns `{status, dbConnected, time}`. |
| `GET`  | `/moves` | API key | List of seeded moves with `{id, name, sortOrder, measurementType}`. |
| `POST` | `/sync/events` | API key | Push outbox of `LogEntry` events. Idempotent by `id`; returns accepted + conflicts. |

Auth header: `Authorization: Bearer <API_KEY>`.

## Tests

```bash
npm test            # run once
npm run test:watch  # watch mode
```

Tests use `:memory:` SQLite via `DB_DIALECT=sqlite DATABASE_URL=:memory:`. The schema is created in-place (no migrations needed for tests).

## Build

```bash
npm run check       # tsc --noEmit
npm run build       # emits dist/
npm start           # node dist/index.js (uses NODE_ENV=production)
```

## Deployment (Railway)

1. Repo is public; Railway service set up via dashboard or CLI.
2. Auto-deploy from `main`.
3. Required env vars in Railway:
   - `DATABASE_URL` — Railway MySQL connection string
   - `API_KEY` — generate with `openssl rand -hex 32`
   - `NODE_ENV=production`
4. Optional: `SINGLE_USER_ID` (UUID). If unset, server generates and prints to logs on first boot — copy from logs and set so future deploys reuse it.
5. Healthcheck: `/health`. Configured in `railway.toml`.

## Project layout

```
track-workout-api/
├── PLAN.md                   ← scope, decisions, status
├── CLAUDE.md                 ← agent-facing instructions
├── README.md                 ← this file
├── src/
│   ├── index.ts              ← entry (calls createServer + listen)
│   ├── server.ts             ← createServer() factory (testable)
│   ├── db.ts                 ← dialect detection + connection singleton
│   ├── auth.ts               ← requireApiKey middleware
│   ├── seed.ts               ← idempotent seed: 13 moves + single user
│   ├── db/
│   │   ├── schema.ts         ← MySQL schema (Drizzle)
│   │   └── schema.sqlite.ts  ← SQLite mirror (Drizzle)
│   └── routes/
│       ├── health.ts
│       ├── moves.ts
│       └── sync.ts
├── tests/
│   └── sync.test.ts          ← Vitest (9 tests, in-memory SQLite)
├── drizzle/
│   └── mysql-migrations/     ← drizzle-kit generated
├── drizzle.config.ts
├── package.json
├── tsconfig.json + tsconfig.build.json
├── railway.toml
└── .env.example
```

## Wiring iOS to this server

In iOS (Track Workout app):

```swift
UserDefaults.standard.set("https://<railway-url>/sync/events", forKey: "sync.endpoint")
UserDefaults.standard.set("<API_KEY>", forKey: "authToken")
```

Then logging an entry posts to this server. See `WorkoutViewModel.swift`.

## Status

Initial scaffold complete. Single-user, push-only sync, SQLite tests passing locally. Not yet deployed to Railway.

See [PLAN.md](PLAN.md) for scope, decisions, and follow-ups.
