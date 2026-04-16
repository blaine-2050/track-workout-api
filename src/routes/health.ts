import { Router } from "express";
import { getDb, getSchema } from "../db.js";

export const healthRouter: Router = Router();

healthRouter.get("/health", async (_req, res) => {
  let dbConnected = false;
  try {
    const db = await getDb();
    const schema = await getSchema();
    await db.select().from(schema.users).limit(1);
    dbConnected = true;
  } catch {
    dbConnected = false;
  }
  res.status(200).json({
    status: "ok",
    dbConnected,
    time: new Date().toISOString(),
  });
});
