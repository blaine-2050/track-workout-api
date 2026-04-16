// Idempotent seed: 13 canonical moves + single user.
// Called by createServer() on boot.

import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb, getSchema } from "./db.js";

interface SeedMove {
  name: string;
  sortOrder: number;
  measurementType: "strength" | "interval";
}

const SEED_MOVES: SeedMove[] = [
  { name: "Bench Press", sortOrder: 1, measurementType: "strength" },
  { name: "Single Arm Snatch", sortOrder: 2, measurementType: "strength" },
  { name: "Incline DB Press", sortOrder: 3, measurementType: "strength" },
  { name: "Military DB Press", sortOrder: 4, measurementType: "strength" },
  { name: "Squat", sortOrder: 5, measurementType: "strength" },
  { name: "Split Squat", sortOrder: 6, measurementType: "strength" },
  { name: "Deadlift", sortOrder: 7, measurementType: "strength" },
  { name: "Lat Pull Down", sortOrder: 8, measurementType: "strength" },
  { name: "Bent Over Row", sortOrder: 9, measurementType: "strength" },
  { name: "Leg Press", sortOrder: 10, measurementType: "strength" },
  { name: "MTB", sortOrder: 11, measurementType: "interval" },
  { name: "Elliptical", sortOrder: 12, measurementType: "interval" },
  { name: "Treadmill", sortOrder: 13, measurementType: "interval" },
];

let _cachedUserId: string | null = null;

export async function ensureSeed(): Promise<{ userId: string }> {
  const db = await getDb();
  const schema = await getSchema();

  // Single user
  let userId = process.env.SINGLE_USER_ID ?? _cachedUserId;
  if (userId) {
    const existing = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (existing.length === 0) {
      await db.insert(schema.users).values({ id: userId, email: null, createdAt: new Date() });
    }
  } else {
    const any = await db.select().from(schema.users).limit(1);
    if (any.length > 0) {
      userId = any[0].id;
    } else {
      userId = randomUUID();
      await db.insert(schema.users).values({ id: userId, email: null, createdAt: new Date() });
      console.log(`[seed] created single user with id=${userId}; set SINGLE_USER_ID to pin it`);
    }
  }
  _cachedUserId = userId!;

  // Moves — insert any missing by name
  const existingMoves = await db.select().from(schema.moves);
  const existingNames = new Set<string>(existingMoves.map((m: { name: string }) => m.name));
  for (const m of SEED_MOVES) {
    if (!existingNames.has(m.name)) {
      await db.insert(schema.moves).values({
        id: randomUUID(),
        name: m.name,
        sortOrder: m.sortOrder,
        measurementType: m.measurementType,
      });
    }
  }

  return { userId: _cachedUserId };
}

export function getSeededUserId(): string {
  if (!_cachedUserId) {
    throw new Error("ensureSeed() must be called before getSeededUserId()");
  }
  return _cachedUserId;
}
