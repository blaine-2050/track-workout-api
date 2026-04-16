import { Router } from "express";
import { getDb, getSchema } from "../db.js";
import { requireApiKey } from "../auth.js";

export const movesRouter: Router = Router();

movesRouter.get("/moves", requireApiKey, async (_req, res) => {
  const db = await getDb();
  const schema = await getSchema();
  const rows = await db.select().from(schema.moves);
  rows.sort((a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder);
  res.json(
    rows.map((m: { id: string; name: string; sortOrder: number; measurementType: string }) => ({
      id: m.id,
      name: m.name,
      sortOrder: m.sortOrder,
      measurementType: m.measurementType,
    })),
  );
});
