import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

// The external configuration contains synthetic review credentials, never main DB credentials.
if (!process.argv[2]) throw new Error("Pass the private review settings JSON outside the repository.");
const { env } = JSON.parse(await readFile(process.argv[2], "utf8"));
if (env.APP_ENV !== "review" || new URL(env.DATABASE_URL).pathname !== "/set_mob_review"
  || new URL(env.DATABASE_URL).hostname !== env.REVIEW_DATABASE_HOST) throw new Error("An isolated review database is required.");
const port = process.env.REVIEW_PREVIEW_PORT ?? "3001";
if (!/^\d{4,5}$/.test(port)) throw new Error("Invalid port.");
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", port, "--hostname", "127.0.0.1"], {
  stdio: "inherit", windowsHide: true,
  env: { ...process.env, ...env, REVIEW_API_ORIGIN: `http://localhost:${port}`, APP_BASE_URL: origin,
    RESEND_API_KEY: "", LINE_CHANNEL_ID: "", LINE_CHANNEL_SECRET: "", LINE_MESSAGING_ACCESS_TOKEN: "", LINE_MESSAGING_CHANNEL_SECRET: "",
    LINE_LOGIN_REDIRECT_URI: "", ADMIN_EMAILS: "", AUTH_DELIVERY_MODE: "disabled" },
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
