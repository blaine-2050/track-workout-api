import { defineConfig } from "drizzle-kit";

const dialect = (process.env.DB_DIALECT ?? (process.env.DATABASE_URL?.startsWith("mysql") ? "mysql" : "sqlite")) as
  | "mysql"
  | "sqlite";

export default defineConfig(
  dialect === "sqlite"
    ? {
        schema: "./src/db/schema.sqlite.ts",
        out: "./drizzle/sqlite-migrations",
        dialect: "sqlite",
        dbCredentials: { url: process.env.DATABASE_URL ?? "local.db" },
      }
    : {
        schema: "./src/db/schema.ts",
        out: "./drizzle/mysql-migrations",
        dialect: "mysql",
        dbCredentials: { url: process.env.DATABASE_URL! },
      },
);
