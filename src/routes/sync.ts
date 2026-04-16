// POST /sync/events — accept iOS outbox payloads.
//
// For each incoming event:
//   - new id              → INSERT, action="inserted"
//   - existing id, newer  → UPDATE, action="updated"
//   - existing id, older  → log to tw_sync_conflicts, return in `conflicts`
//
// Also ensures the parent Workout row exists (created from event.startedAt
// if missing). Returns nextCursor = serverTime so a future GET endpoint
// can use the same cursor convention.

import { Router } from "express";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb, getSchema } from "../db.js";
import { requireApiKey } from "../auth.js";
import { getSeededUserId } from "../seed.js";

interface IncomingEvent {
  id: string;
  moveId: string;
  move: string;
  measurementType: "strength" | "aerobic";
  weight: number;
  reps: number;
  durationSeconds: number;
  startedAt: string;
  updatedAt: string;
  endedAt?: string | null;
  weightRecordedAt?: string | null;
  repsRecordedAt?: string | null;
  intensity?: number | null;
  intensityMetric?: string | null;
  intervalKind?: string | null;
  intervalLabel?: string | null;
  // The iOS payload doesn't include workoutId or weightUnit yet.
  // We treat workoutId as null until the iOS side sends it.
  workoutId?: string | null;
  weightUnit?: "kg" | "lbs" | null;
}

interface SyncRequestBody {
  cursor: string | null;
  events: IncomingEvent[];
}

interface AcceptedRecord {
  id: string;
  action: "inserted" | "updated";
}

interface ConflictRecord {
  id: string;
  reason: string;
  serverUpdatedAt: string;
  clientUpdatedAt: string;
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export const syncRouter: Router = Router();

syncRouter.post("/sync/events", requireApiKey, async (req, res) => {
  const body = req.body as Partial<SyncRequestBody> | undefined;
  if (!body || !Array.isArray(body.events)) {
    res.status(400).json({ error: "Body must include events: []", code: "bad_request" });
    return;
  }

  const db = await getDb();
  const schema = await getSchema();
  const userId = getSeededUserId();
  const accepted: AcceptedRecord[] = [];
  const conflicts: ConflictRecord[] = [];
  const serverTime = new Date();

  for (const ev of body.events) {
    if (!ev.id || !ev.moveId || !ev.measurementType || !ev.startedAt || !ev.updatedAt) {
      // Skip malformed events silently — client will retry whole outbox next time.
      continue;
    }
    const incomingUpdated = parseDate(ev.updatedAt);
    const incomingStarted = parseDate(ev.startedAt);
    if (!incomingUpdated || !incomingStarted) continue;

    const existing = await db
      .select()
      .from(schema.logEntries)
      .where(eq(schema.logEntries.id, ev.id))
      .limit(1);

    const row = {
      id: ev.id,
      userId,
      workoutId: ev.workoutId ?? null,
      moveId: ev.moveId,
      moveNameSnapshot: ev.move ?? "Unknown",
      measurementType: ev.measurementType,
      weight: ev.measurementType === "strength" ? ev.weight : null,
      weightUnit: ev.weightUnit ?? null,
      reps: ev.measurementType === "strength" ? ev.reps : null,
      durationSeconds: ev.measurementType === "aerobic" ? ev.durationSeconds : null,
      startedAt: incomingStarted,
      endedAt: parseDate(ev.endedAt),
      weightRecordedAt: parseDate(ev.weightRecordedAt),
      repsRecordedAt: parseDate(ev.repsRecordedAt),
      intensity: ev.intensity ?? null,
      intensityMetric: ev.intensityMetric ?? null,
      intervalKind: ev.intervalKind ?? null,
      intervalLabel: ev.intervalLabel ?? null,
      updatedAt: incomingUpdated,
    };

    if (existing.length === 0) {
      await ensureWorkout(db, schema, row.workoutId, userId, incomingStarted, incomingUpdated);
      await db.insert(schema.logEntries).values(row);
      accepted.push({ id: ev.id, action: "inserted" });
      continue;
    }

    const serverUpdated: Date = existing[0].updatedAt instanceof Date ? existing[0].updatedAt : new Date(existing[0].updatedAt);

    if (incomingUpdated.getTime() < serverUpdated.getTime()) {
      await db.insert(schema.syncConflicts).values({
        entryId: ev.id,
        clientUpdatedAt: incomingUpdated,
        serverUpdatedAt: serverUpdated,
        reason: "older_than_server",
        createdAt: serverTime,
      });
      conflicts.push({
        id: ev.id,
        reason: "older_than_server",
        serverUpdatedAt: serverUpdated.toISOString(),
        clientUpdatedAt: incomingUpdated.toISOString(),
      });
      continue;
    }

    await ensureWorkout(db, schema, row.workoutId, userId, incomingStarted, incomingUpdated);
    await db.update(schema.logEntries).set(row).where(eq(schema.logEntries.id, ev.id));
    accepted.push({ id: ev.id, action: "updated" });
  }

  res.json({
    serverTime: serverTime.toISOString(),
    nextCursor: serverTime.toISOString(),
    accepted,
    conflicts,
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureWorkout(
  db: any,
  schema: any,
  workoutId: string | null,
  userId: string,
  startedAt: Date,
  updatedAt: Date,
): Promise<void> {
  if (!workoutId) return;
  const existing = await db.select().from(schema.workouts).where(eq(schema.workouts.id, workoutId)).limit(1);
  if (existing.length > 0) return;
  await db.insert(schema.workouts).values({
    id: workoutId,
    userId,
    startedAt,
    endedAt: null,
    updatedAt,
  });
}

// Exposed for tests
export { randomUUID as _randomUUID };
