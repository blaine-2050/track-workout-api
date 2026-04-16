// SQLite mirror of schema.ts for tests.
// Same column names; SQLite's type system is looser so we use text/integer/real.

import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("tw_users", {
  id: text("id").primaryKey(),
  email: text("email"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const moves = sqliteTable(
  "tw_moves",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    sortOrder: integer("sort_order").notNull(),
    measurementType: text("measurement_type", { enum: ["strength", "interval"] }).notNull(),
  },
  (t) => ({
    nameIdx: index("tw_moves_name_idx").on(t.name),
  }),
);

export const workouts = sqliteTable(
  "tw_workouts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    userIdx: index("tw_workouts_user_idx").on(t.userId),
  }),
);

export const logEntries = sqliteTable(
  "tw_log_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    workoutId: text("workout_id"),
    moveId: text("move_id").notNull(),
    moveNameSnapshot: text("move_name_snapshot").notNull(),
    measurementType: text("measurement_type", { enum: ["strength", "aerobic"] }).notNull(),
    weight: real("weight"),
    weightUnit: text("weight_unit", { enum: ["kg", "lbs"] }),
    reps: integer("reps"),
    durationSeconds: integer("duration_seconds"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    weightRecordedAt: integer("weight_recorded_at", { mode: "timestamp_ms" }),
    repsRecordedAt: integer("reps_recorded_at", { mode: "timestamp_ms" }),
    intensity: real("intensity"),
    intensityMetric: text("intensity_metric"),
    intervalKind: text("interval_kind"),
    intervalLabel: text("interval_label"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    userIdx: index("tw_entries_user_idx").on(t.userId),
    workoutIdx: index("tw_entries_workout_idx").on(t.workoutId),
    updatedAtIdx: index("tw_entries_updated_at_idx").on(t.updatedAt),
  }),
);

export const syncConflicts = sqliteTable("tw_sync_conflicts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entryId: text("entry_id").notNull(),
  clientUpdatedAt: integer("client_updated_at", { mode: "timestamp_ms" }).notNull(),
  serverUpdatedAt: integer("server_updated_at", { mode: "timestamp_ms" }).notNull(),
  reason: text("reason").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
