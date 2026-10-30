import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const configPath = process.argv[2];
if (!configPath) throw new Error("Pass an isolated database configuration JSON outside the repository.");
const config = JSON.parse(await readFile(configPath, "utf8"));
if (!/^br-[a-z0-9-]+$/.test(config.branchId ?? "") || config.branchId === "br-divine-flower-axs271rq") throw new Error("A non-production Neon branch is required.");
const source = await readFile(new URL("../.env.local", import.meta.url), "utf8").catch(() => "");
const production = /^DATABASE_URL\s*=\s*["']?([^\r\n"']+)/m.exec(source)?.[1];
if (production && new URL(production).hostname.replace("-pooler", "") === new URL(config.url).hostname.replace("-pooler", "")) throw new Error("The test endpoint resolves to the production hostname.");
const testFile = process.argv[3] === "review" ? "tests/review-db.test.mjs" : "tests/lifecycle-db.test.mjs";
const child = spawn(process.execPath, ["--test", testFile], {
  stdio: "inherit",
  env: { ...process.env, TEST_DATABASE_URL: config.url, DB_TEST_BRANCH_ID: config.branchId },
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
