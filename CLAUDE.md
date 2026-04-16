# CLAUDE.md — track-workout-api

## What this is
Sync server for [Track Workout](https://github.com/blaine-2050/track-workout-core). Receives workout events from platform clients (iOS first), persists to MySQL on Railway. Stack: Node + TypeScript + Express + Drizzle + mysql2.

## Source of truth
Wire format and data model live in:
- https://github.com/blaine-2050/track-workout-core/blob/main/DATA_MODEL.md (canonical schema + sync contract)
- iOS client's `WorkoutViewModel.swift` (the actual Swift Codable types being POSTed)

If the spec changes, update `track-workout-core` first, then this repo + the iOS repo.

## Stack (one line)
Node ≥20, TypeScript, Express, Drizzle ORM, MySQL (Railway shared instance, `tw_` table prefix), Vitest + in-memory SQLite for tests.

## Conventions
- **Single user mode** (current): static `API_KEY` env var in `Authorization: Bearer …`. No login flow yet.
- **Server owns the move catalog.** Clients filter their visible subset locally.
- **Conflict policy:** log to `tw_sync_conflicts`, return in response. No UX yet.
- **Push on log:** the iOS client POSTs after every Log. No batching.
- Use npm (not pnpm), per project preference.
- Dialect detection in `src/db.ts` mirrors `medbridge/server/db.ts` (MySQL when `DATABASE_URL` starts with `mysql`, SQLite otherwise; default SQLite for local/test).

## Environment variables (see `.env.example`)
- `DATABASE_URL` — MySQL connection string in prod; `:memory:` or local file path for SQLite.
- `API_KEY` — static bearer token for the single user. Generate with `openssl rand -hex 32`.
- `SINGLE_USER_ID` — UUID for the seed user. If unset, generated on first boot and printed.
- `PORT` — Railway sets this; defaults to 3000.
- `NODE_ENV` — `development` / `production`.

## Deployment
- Railway, NIXPACKS builder, auto-deploy from `main`.
- Healthcheck: `GET /health` (Railway calls every 60s).
- Database: shared Railway MySQL, table prefix `tw_`.

## Related repos
- https://github.com/blaine-2050/track-workout-core — prose specs (PRD, DATA_MODEL, COMPUTER_USE_PROTOCOL, etc.)
- https://github.com/blaine-2050/track-workout-ios-swift — iOS client
- (future) `-android-react`, `-ios-web`, `-macos-swift`

## Where things go
- `src/server.ts` — `createServer()` factory (testable, no listen).
- `src/index.ts` — entry; calls `createServer()` and `listen`.
- `src/db.ts` — dialect detection + connection singleton.
- `src/auth.ts` — `requireApiKey` middleware.
- `src/routes/{health,sync,moves}.ts` — one file per endpoint group.
- `src/seed.ts` — idempotent seed for moves + single user.
- `drizzle/schema.ts` — MySQL schema; `drizzle/schema.sqlite.ts` — SQLite mirror.
- `tests/*.test.ts` — Vitest, runs against `DATABASE_URL=:memory:`.
