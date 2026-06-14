import "dotenv/config";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const videoId = process.argv[2];
if (!videoId) {
  console.error("Usage: node scripts/retry-transcript.mjs <videoId>");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query(
  'SELECT video_id, video_url, transcript IS NOT NULL AS has_transcript FROM videos WHERE video_id = $1',
  [videoId]
);
if (rows.length === 0) {
  console.error("Video not found");
  process.exit(1);
}
const { video_url, has_transcript } = rows[0];
console.log(`videoUrl: ${video_url}`);
console.log(`has existing transcript: ${has_transcript}`);

console.log("Fetching video from R2...");
const videoResponse = await fetch(video_url);
console.log(`R2 status: ${videoResponse.status} ${videoResponse.statusText}`);
if (!videoResponse.ok) {
  console.error(await videoResponse.text());
  process.exit(1);
}
const videoBlob = await videoResponse.blob();
console.log(`Video: ${videoBlob.size} bytes, type=${videoBlob.type}`);

const form = new FormData();
form.append("file", videoBlob, `${videoId}.webm`);
form.append("model", "whisper-large-v3-turbo");
form.append("response_format", "verbose_json");

console.log("Calling Groq...");
const groqResponse = await fetch(
  "https://api.groq.com/openai/v1/audio/transcriptions",
  {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
  }
);
console.log(`Groq status: ${groqResponse.status}`);
const bodyText = await groqResponse.text();
if (!groqResponse.ok) {
  console.error("Groq error body:", bodyText);
  process.exit(1);
}
const json = JSON.parse(bodyText);
console.log(`Transcribed text length: ${json.text?.length ?? 0}`);
console.log(`Segments: ${json.segments?.length ?? 0}`);
console.log(`First 200 chars of text: "${(json.text ?? "").slice(0, 200)}"`);

await pool.end();
