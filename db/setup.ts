/**
 * Run once after provisioning your Neon database:
 *   npm run db:setup
 * Requires DATABASE_URL in .env.local
 */
import fs from "fs";
import path from "path";
import { Pool } from "pg";
import "dotenv/config";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set. Add it to .env.local first.");
    process.exit(1);
  }
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await pool.query(sql);
  console.log("✓ Schema applied.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
