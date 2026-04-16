// createServer() — testable Express app factory. Does not call listen().
// src/index.ts is the entry that boots and listens.

import express, { type Express } from "express";
import { healthRouter } from "./routes/health.js";
import { movesRouter } from "./routes/moves.js";
import { syncRouter } from "./routes/sync.js";
import { ensureSeed } from "./seed.js";

export async function createServer(): Promise<Express> {
  await ensureSeed();

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(healthRouter);
  app.use(movesRouter);
  app.use(syncRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "not found", code: "not_found" });
  });

  return app;
}
