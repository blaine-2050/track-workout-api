import type { Request, Response, NextFunction } from "express";

const BEARER_PREFIX = "Bearer ";

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.API_KEY;
  if (!expected) {
    res.status(500).json({ error: "API_KEY not configured on server", code: "server_misconfigured" });
    return;
  }

  const header = req.header("authorization") ?? "";
  if (!header.startsWith(BEARER_PREFIX)) {
    res.status(401).json({ error: "Authorization header missing or malformed", code: "unauthorized" });
    return;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (token !== expected) {
    res.status(401).json({ error: "Invalid API key", code: "unauthorized" });
    return;
  }

  next();
}
