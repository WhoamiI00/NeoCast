import "dotenv/config";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const OLD = "https://pub-d25de56ed8e340c4a96b376a5fb769d1.r2.dev";
const NEW = "https://cdn.neokit.app";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rowCount: vidCount } = await pool.query(
  `UPDATE videos SET video_url = REPLACE(video_url, $1, $2) WHERE video_url LIKE $3`,
  [OLD, NEW, `${OLD}%`]
);
const { rowCount: thumbCount } = await pool.query(
  `UPDATE videos SET thumbnail_url = REPLACE(thumbnail_url, $1, $2) WHERE thumbnail_url LIKE $3`,
  [OLD, NEW, `${OLD}%`]
);

console.log(`Rewrote ${vidCount} video URLs and ${thumbCount} thumbnail URLs ✓`);
await pool.end();
