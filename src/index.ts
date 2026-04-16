import "dotenv/config";
import { createServer } from "./server.js";

const port = Number(process.env.PORT) || 3000;

async function main(): Promise<void> {
  const app = await createServer();
  app.listen(port, () => {
    console.log(`[track-workout-api] listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error("[track-workout-api] failed to start:", err);
  process.exit(1);
});
