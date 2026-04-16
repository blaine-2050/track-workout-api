import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createServer } from "../src/server.js";
import { resetDb } from "../src/db.js";

const API_KEY = "test-key";
const auth = `Bearer ${API_KEY}`;

function nowIso(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function strengthEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: randomUUID(),
    moveId: randomUUID(),
    move: "Bench Press",
    measurementType: "strength",
    weight: 135,
    reps: 10,
    durationSeconds: 0,
    startedAt: nowIso(-5000),
    updatedAt: nowIso(),
    ...overrides,
  };
}

describe("POST /sync/events", () => {
  beforeEach(() => {
    resetDb();
  });

  it("requires API key", async () => {
    const app = await createServer();
    const res = await request(app).post("/sync/events").send({ cursor: null, events: [] });
    expect(res.status).toBe(401);
  });

  it("rejects malformed body", async () => {
    const app = await createServer();
    const res = await request(app).post("/sync/events").set("Authorization", auth).send({});
    expect(res.status).toBe(400);
  });

  it("inserts a new event", async () => {
    const app = await createServer();
    const ev = strengthEvent();
    const res = await request(app)
      .post("/sync/events")
      .set("Authorization", auth)
      .send({ cursor: null, events: [ev] });
    expect(res.status).toBe(200);
    expect(res.body.accepted).toEqual([{ id: ev.id, action: "inserted" }]);
    expect(res.body.conflicts).toEqual([]);
    expect(typeof res.body.serverTime).toBe("string");
    expect(typeof res.body.nextCursor).toBe("string");
  });

  it("is idempotent: re-sending the same event updates it", async () => {
    const app = await createServer();
    const ev = strengthEvent();
    await request(app).post("/sync/events").set("Authorization", auth).send({ cursor: null, events: [ev] });
    const second = await request(app)
      .post("/sync/events")
      .set("Authorization", auth)
      .send({ cursor: null, events: [{ ...ev, updatedAt: nowIso(1000) }] });
    expect(second.status).toBe(200);
    expect(second.body.accepted).toEqual([{ id: ev.id, action: "updated" }]);
    expect(second.body.conflicts).toEqual([]);
  });

  it("logs a conflict when incoming.updatedAt < server.updatedAt", async () => {
    const app = await createServer();
    const ev = strengthEvent({ updatedAt: nowIso(0) });
    await request(app).post("/sync/events").set("Authorization", auth).send({ cursor: null, events: [ev] });

    const stale = await request(app)
      .post("/sync/events")
      .set("Authorization", auth)
      .send({ cursor: null, events: [{ ...ev, updatedAt: nowIso(-60_000) }] });

    expect(stale.status).toBe(200);
    expect(stale.body.accepted).toEqual([]);
    expect(stale.body.conflicts).toHaveLength(1);
    expect(stale.body.conflicts[0].id).toBe(ev.id);
    expect(stale.body.conflicts[0].reason).toBe("older_than_server");
  });

  it("accepts an empty events array", async () => {
    const app = await createServer();
    const res = await request(app)
      .post("/sync/events")
      .set("Authorization", auth)
      .send({ cursor: null, events: [] });
    expect(res.status).toBe(200);
    expect(res.body.accepted).toEqual([]);
    expect(res.body.conflicts).toEqual([]);
  });
});

describe("GET /moves", () => {
  beforeEach(() => {
    resetDb();
  });

  it("requires API key", async () => {
    const app = await createServer();
    const res = await request(app).get("/moves");
    expect(res.status).toBe(401);
  });

  it("returns the 13 seeded moves in sortOrder", async () => {
    const app = await createServer();
    const res = await request(app).get("/moves").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(13);
    expect(res.body[0].name).toBe("Bench Press");
    expect(res.body[12].name).toBe("Treadmill");
    expect(res.body[12].measurementType).toBe("interval");
  });
});

describe("GET /health", () => {
  beforeEach(() => {
    resetDb();
  });

  it("returns ok and dbConnected=true after seed", async () => {
    const app = await createServer();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.dbConnected).toBe(true);
  });
});
