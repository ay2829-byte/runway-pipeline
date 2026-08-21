// Pulls live postings from public Greenhouse job boards and upserts them
// into the `jobs` table in Supabase. Run on a schedule by GitHub Actions
// (see .github/workflows/collect-data.yml) or manually with:
//   npm run collect-jobs

import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Add more company board tokens here as you grow the job feed. Each token
// is the slug Greenhouse uses in its public API: boards-api.greenhouse.io/v1/boards/{token}/jobs
const GREENHOUSE_BOARDS = [
  "airbnb", "doordash", "robinhood", "coinbase", "stripe", "gitlab",
  "figma", "notion", "asana", "discord", "plaid", "brex",
];

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchBoard(board) {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`
  );
  if (!res.ok) throw new Error(`${board}: HTTP ${res.status}`);
  const data = await res.json();
  return (data.jobs || []).map((j) => ({
    id: `greenhouse:${board}:${j.id}`,
    company: board,
    title: j.title,
    description: stripHtml(j.content).slice(0, 2000),
    url: j.absolute_url,
    source: "live",
    updated_at: new Date().toISOString(),
  }));
}

async function main() {
  const results = await Promise.allSettled(GREENHOUSE_BOARDS.map(fetchBoard));

  const allJobs = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      allJobs.push(...r.value);
      console.log(`${GREENHOUSE_BOARDS[i]}: ${r.value.length} jobs`);
    } else {
      console.warn(`${GREENHOUSE_BOARDS[i]}: failed — ${r.reason}`);
    }
  });

  if (allJobs.length === 0) {
    console.warn("No jobs collected from any board. Nothing to write.");
    return;
  }

  // Upsert in batches to stay well under request size limits.
  const BATCH = 200;
  for (let i = 0; i < allJobs.length; i += BATCH) {
    const chunk = allJobs.slice(i, i + BATCH);
    const { error } = await supabase.from("jobs").upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error("Upsert error:", error.message);
      process.exitCode = 1;
    }
  }

  console.log(`Done. Wrote ${allJobs.length} jobs to Supabase.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
