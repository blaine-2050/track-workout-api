// MySQL schema for track-workout-api.
// Mirrored (with type adaptations) in schema.sqlite.ts.
// Table prefix: tw_

import {
  mysqlTable,
  varchar,
  datetime,
  decimal,
  int,
  mysqlEnum,
  primaryKey,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("tw_users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }),
  createdAt: datetime("created_at").notNull(),
});

export const moves = mysqlTable(
  "tw_moves",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 64 }).notNull().unique(),
    sortOrder: int("sort_order").notNull(),
    measurementType: mysqlEnum("measurement_type", ["strength", "interval"]).notNull(),
  },
  (t) => ({
    nameIdx: index("tw_moves_name_idx").on(t.name),
  }),
);

export const workouts = mysqlTable(
  "tw_workouts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    startedAt: datetime("started_at").notNull(),
    endedAt: datetime("ended_at"),
    updatedAt: datetime("updated_at").notNull(),
  },
  (t) => ({
    userIdx: index("tw_workouts_user_idx").on(t.userId),
  }),
);

export const logEntries = mysqlTable(
  "tw_log_entries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull(),
    workoutId: varchar("workout_id", { length: 36 }),
    moveId: varchar("move_id", { length: 36 }).notNull(),
    moveNameSnapshot: varchar("move_name_snapshot", { length: 64 }).notNull(),
    measurementType: mysqlEnum("measurement_type", ["strength", "aerobic"]).notNull(),
    weight: decimal("weight", { precision: 8, scale: 2 }),
    weightUnit: mysqlEnum("weight_unit", ["kg", "lbs"]),
    reps: int("reps"),
    durationSeconds: int("duration_seconds"),
    startedAt: datetime("started_at").notNull(),
    endedAt: datetime("ended_at"),
    weightRecordedAt: datetime("weight_recorded_at"),
    repsRecordedAt: datetime("reps_recorded_at"),
    intensity: decimal("intensity", { precision: 4, scale: 2 }),
    intensityMetric: varchar("intensity_metric", { length: 32 }),
    intervalKind: varchar("interval_kind", { length: 16 }),
    intervalLabel: varchar("interval_label", { length: 64 }),
    updatedAt: datetime("updated_at").notNull(),
  },
  (t) => ({
    userIdx: index("tw_entries_user_idx").on(t.userId),
    workoutIdx: index("tw_entries_workout_idx").on(t.workoutId),
    updatedAtIdx: index("tw_entries_updated_at_idx").on(t.updatedAt),
  }),
);

export const syncConflicts = mysqlTable("tw_sync_conflicts", {
  id: int("id").primaryKey().autoincrement(),
  entryId: varchar("entry_id", { length: 36 }).notNull(),
  clientUpdatedAt: datetime("client_updated_at").notNull(),
  serverUpdatedAt: datetime("server_updated_at").notNull(),
  reason: varchar("reason", { length: 64 }).notNull(),
  createdAt: datetime("created_at").notNull(),
});
