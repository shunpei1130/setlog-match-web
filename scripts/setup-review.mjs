import { neon } from "@neondatabase/serverless";
import { scryptSync } from "node:crypto";

// Secrets are provided through the environment, never command-line arguments.
const required = ["DATABASE_URL", "REVIEW_DATABASE_HOST", "REVIEW_ENVIRONMENT_ID", "AUTH_SECRET_PEPPER", "REVIEW_LOGIN_USERNAME", "REVIEW_LOGIN_PASSWORD"];
for (const key of required) if (!process.env[key]) throw new Error(`${key} is required.`);
if (process.env.APP_ENV !== "review" || new URL(process.env.DATABASE_URL).hostname !== process.env.REVIEW_DATABASE_HOST) throw new Error("An isolated review database must be explicitly selected.");
const sql = neon(process.env.DATABASE_URL);
const [others] = await sql`SELECT count(*)::int AS count FROM users WHERE email NOT IN ('review-a@set-mob.invalid','review-b@set-mob.invalid')`;
if (others.count) throw new Error("The database contains non-review users. Nothing was changed.");
await sql.transaction([
  sql`CREATE TABLE IF NOT EXISTS review_environment (id uuid PRIMARY KEY)`,
  sql`CREATE TABLE IF NOT EXISTS review_login_attempts (id integer PRIMARY KEY,attempts integer NOT NULL,window_start timestamptz NOT NULL)`,
]);
await sql`INSERT INTO review_environment (id) VALUES (${process.env.REVIEW_ENVIRONMENT_ID}::uuid) ON CONFLICT DO NOTHING`;
if (process.env.REVIEW_WRITE_PASSWORD_HASH === "true") {
  // Use only in a private local terminal to transfer to the deployment secret UI.
  process.stdout.write(scryptSync(process.env.REVIEW_LOGIN_PASSWORD, process.env.AUTH_SECRET_PEPPER, 64).toString("hex"));
} else console.log("Review database initialized. Configure REVIEW_PASSWORD_HASH securely before sign-in.");
