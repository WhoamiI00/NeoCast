import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY table_name
`;
console.log("Tables in public schema:", tables.map((t) => t.table_name));

for (const { table_name } of tables) {
  try {
    const [{ count }] = await sql.query(
      `SELECT COUNT(*)::int AS count FROM "${table_name}"`
    );
    console.log(`  ${table_name}: ${count} rows`);
  } catch (e) {
    console.log(`  ${table_name}: error reading - ${e.message}`);
  }
}
