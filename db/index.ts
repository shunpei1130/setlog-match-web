import { Client, neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function getDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return drizzle(neon(connectionString), { schema });
}

/** Interactive transactions are reserved for pairing lifecycle changes. */
export function withLifecycleTransaction<T>(operation: (client: Client) => Promise<T>): Promise<T>;
export function withLifecycleTransaction<T>(operation: (client: Client) => Promise<T>, skipIfBusy: true): Promise<T | undefined>;
export async function withLifecycleTransaction<T>(operation: (client: Client) => Promise<T>, skipIfBusy = false): Promise<T | undefined> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const client = new Client(process.env.DATABASE_URL);
  client.neonConfig.webSocketConstructor = globalThis.WebSocket;
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    // All lifecycle writers take this lock before row locks. The initial pool is
    // capped at 100; serializing these short transactions also prevents races
    // between a block, a second answer, and an extension reservation.
    if (skipIfBusy) {
      const { rows: [lock] } = await client.query("SELECT pg_try_advisory_xact_lock(73241901) AS acquired");
      if (!lock.acquired) { await client.query("COMMIT"); return; }
    } else await client.query("SELECT pg_advisory_xact_lock(73241901)");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}
