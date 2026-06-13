import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

// Reuse a single postgres-js client across hot reloads (dev) and module
// re-evaluations so we don't leak connections. In serverless each instance gets
// its own bounded pool.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.pgClient ??
  postgres(process.env.DATABASE_URL!, {
    // Bound the pool per instance so many concurrent serverless invocations
    // don't exhaust the database's connection limit.
    max: 5,
    // Drop idle connections quickly so short-lived instances release them.
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
