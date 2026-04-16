# track-workout-api — Implementation Plan

## Goal
A small JSON API that accepts the iOS client's existing `POST /sync/events` payload, persists workout events to MySQL on Railway, and is reachable from a real iPhone in a real gym.

**Source-of-truth specs:**
- Wire format: defined by [`track-workout-ios-swift/TrackWorkout/.../WorkoutViewModel.swift`](https://github.com/blaine-2050/track-workout-ios-swift/blob/main/TrackWorkout/TrackWorkout/ViewModels/WorkoutViewModel.swift) (`SyncEventPayload`, `SyncResponsePayload`).
- Data model: [`track-workout-core/DATA_MODEL.md`](https://github.com/blaine-2050/track-workout-core/blob/main/DATA_MODEL.md).
- Sync semantics: idempotent insert/update by id; latest-`updatedAt` wins; conflicts logged.

## Scope (first cut)

✅ In scope:
- `GET /health` — Railway healthcheck.
- `POST /sync/events` — accept outbox, idempotently upsert by id, log conflicts, return cursor.
- Single-user, static API key authentication (`Authorization: Bearer <API_KEY>`).
- Server-owned move catalog (13 seeds), exposed via `GET /moves`.
- MySQL on shared Railway instance, table prefix `tw_`.
- SQLite in-memory for tests (Vitest).
- Railway deploy with auto-deploy from `main`.

❌ Deferred:
- Multi-user, JWT login, signup, password reset.
- `GET /sync/events?cursor=…` server→client pull.
- Conflict-resolution UX in iOS.
- Rate limiting, audit logging, metrics endpoints.

## Decisions (per user, 2026-04-15)

1. **Auth model:** single user, static `API_KEY` env var. No login flow.
2. **Move catalog:** server owns canonical 13 seeds; clients can filter visible moves locally. Exposed via `GET /moves`.
3. **Conflict policy:** log to `tw_sync_conflicts` table for now; surface in response so iOS can count them. No UX for resolving yet.
4. **Sync trigger:** push on every Log (no batching). Matches current iOS behavior.

## Stack

- Node ≥20, TypeScript, Express
- Drizzle ORM with dialect detection (MySQL prod, SQLite tests)
- mysql2 driver for prod, better-sqlite3 for tests
- Vitest
- npm (project preference)
- Railway (Nixpacks builder, auto-deploy `main`)

## Data model (Drizzle)

### `tw_users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar(36) PK | UUID |
| `email` | varchar(255) UNIQUE | nullable for single-user mode |
| `created_at` | datetime | |

Single seed user with `id = SINGLE_USER_ID` env var (or auto-generated on first boot and persisted).

### `tw_moves`
| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar(36) PK | UUID |
| `name` | varchar(64) UNIQUE | "Bench Press", etc. |
| `sort_order` | int | |
| `measurement_type` | enum('strength','interval') | |

Seeded with the 13 canonical moves on first boot.

### `tw_workouts`
| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar(36) PK | UUID |
| `user_id` | varchar(36) FK | |
| `started_at` | datetime | |
| `ended_at` | datetime NULL | |
| `updated_at` | datetime | |

### `tw_log_entries`
| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar(36) PK | UUID |
| `user_id` | varchar(36) FK | |
| `workout_id` | varchar(36) FK NULL | |
| `move_id` | varchar(36) FK | |
| `move_name_snapshot` | varchar(64) | from client `move` field, denormalized |
| `measurement_type` | enum('strength','aerobic') | |
| `weight` | decimal(8,2) NULL | |
| `weight_unit` | enum('kg','lbs') NULL | |
| `reps` | int NULL | |
| `duration_seconds` | int NULL | |
| `started_at` | datetime | |
| `ended_at` | datetime NULL | |
| `weight_recorded_at` | datetime NULL | |
| `reps_recorded_at` | datetime NULL | |
| `intensity` | decimal(4,2) NULL | |
| `intensity_metric` | varchar(32) NULL | |
| `interval_kind` | varchar(16) NULL | |
| `interval_label` | varchar(64) NULL | |
| `updated_at` | datetime | |

### `tw_sync_conflicts`
| Column | Type | Notes |
|--------|------|-------|
| `id` | int AUTO_INCREMENT PK | |
| `entry_id` | varchar(36) | the contested LogEntry id |
| `client_updated_at` | datetime | |
| `server_updated_at` | datetime | |
| `reason` | varchar(64) | e.g. "older_than_server" |
| `created_at` | datetime | |

## Endpoints

### `GET /health`
Returns `{ "status": "ok", "dbConnected": true|false, "time": "ISO8601" }`. Used by Railway healthcheck.

### `POST /sync/events`
Auth: `Authorization: Bearer <API_KEY>`.

Request body matches iOS `SyncRequestPayload`:
```json
{ "cursor": "<opaque>|null", "events": [SyncEventPayload, ...] }
```

For each event:
- If `id` doesn't exist → INSERT with all fields.
- If `id` exists and `incoming.updated_at >= server.updated_at` → UPDATE.
- If `id` exists and `incoming.updated_at <  server.updated_at` → log to `tw_sync_conflicts`, no update.

Also: ensure parent `Workout` record exists (create from event's `started_at` if missing).

Response matches iOS `SyncResponsePayload`:
```json
{ "serverTime": "ISO8601",
  "nextCursor": "<server-time-as-cursor>",
  "accepted":  [{ "id": "...", "action": "inserted|updated" }],
  "conflicts": [{ "id": "...", "reason": "older_than_server",
                  "serverUpdatedAt": "ISO8601",
                  "clientUpdatedAt": "ISO8601" }] }
```

Errors return `{ "error": "...", "code": "..." }`.

### `GET /moves`
Auth: same.

Returns `[{ "id": "...", "name": "...", "sortOrder": 1, "measurementType": "strength" }, ...]`.

## Environment

```
DATABASE_URL=mysql://user:pass@host:3306/dbname  # or :memory: for tests
API_KEY=<generate-strong-random>
SINGLE_USER_ID=<uuid>                              # optional; if unset, auto-generated on first boot
PORT=3000                                          # Railway sets this
NODE_ENV=production
```

## Tests (Vitest, in-memory SQLite)

Each test boots a fresh `:memory:` DB via `DB_DIALECT=sqlite DATABASE_URL=:memory:`. Coverage:

- `sync.test.ts`
  - INSERT new event → 200, accepted=[{id, "inserted"}].
  - INSERT same event again → 200, accepted=[{id, "updated"}], no duplicate.
  - INSERT older event → 200, accepted=[], conflicts=[{id, "older_than_server"}].
  - Auth missing → 401. Auth wrong → 401.
  - Empty events array → 200, accepted=[], conflicts=[], cursor advances.
- `moves.test.ts` — seeded list returns 13 entries with the canonical names.
- `health.test.ts` — `dbConnected: true` after seeding, false when DB unreachable.

## Effort tracker

| Step | Status |
|------|--------|
| Repo scaffold (package.json, tsconfig, drizzle, server) | in progress |
| Schema + seed | |
| `GET /health` | |
| `POST /sync/events` | |
| `GET /moves` | |
| Vitest tests | |
| README + CLAUDE.md | |
| Push to GitHub | |
| Railway deploy | |
| Wire iOS client to Railway URL + API key (in iOS repo) | |

## Open follow-ups (after first cut)

- Add JWT login when multi-user is needed.
- Add `GET /sync/events?cursor=…` for client pull.
- Surface conflicts in iOS UI.
- Rate limiting (probably not needed for single-user).
- Backup story for the Railway MySQL volume (Railway has its own backups but worth verifying).
