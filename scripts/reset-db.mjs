import "dotenv/config";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log("Applying schema...");
const schemaSql = readFileSync("schema-init.sql", "utf8");
const statements = schemaSql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

for (const stmt of statements) {
  await pool.query(stmt);
}

await pool.end();
console.log(`Applied ${statements.length} statements ✓`);
