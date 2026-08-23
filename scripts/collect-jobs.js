// Pulls live postings from public Greenhouse, Lever, Ashby, and Workday job
// boards, filters to US-based roles only (H1B only matters for US jobs),
// and upserts them into the `jobs` table in Supabase. Run daily by GitHub
// Actions (see .github/workflows/collect-data.yml) or manually with:
//   npm run collect-jobs
//
// All four platforms expose public, unauthenticated JSON APIs for company
// job boards, this is legitimate public data, not scraping behind a login
// or against a site's terms. Consumer job search sites like LinkedIn or
// Indeed are deliberately not included here, they block automated access
// and disallow this kind of scraping in their terms — if you want more
// coverage beyond these four platforms, the legitimate path is
// company-by-company public job board APIs like these, not scraping
// search engines.
//
// A bad or renamed token just fails that one company and gets skipped, it
// doesn't break the run, so it's safe to keep a long, generous list here
// rather than only the ones you've hand-verified.

import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);


import { GREENHOUSE_BOARDS, LEVER_BOARDS, ASHBY_BOARDS, WORKDAY_BOARDS } from "./company-list.js";

// ---------------------------------------------------------------------------
// US-location filtering. H1B only applies to US-based roles, so anything
// clearly located outside the US gets dropped. This is a keyword heuristic,
// not perfect — ambiguous or blank locations are kept rather than dropped,
// since a false exclusion (losing a real US posting) is worse than an
// occasional non-US posting slipping through.
// ---------------------------------------------------------------------------
const NON_US_KEYWORDS = [
  "uk", "united kingdom", "london", "india", "bangalore", "hyderabad",
  "pune", "delhi", "mumbai", "chennai", "gurugram", "gurgaon",
  "canada", "toronto", "vancouver", "montreal",
  "germany", "berlin", "munich", "ireland", "dublin",
  "singapore", "australia", "sydney", "melbourne",
  "poland", "warsaw", "philippines", "manila", "mexico", "brazil",
  "sao paulo", "netherlands", "amsterdam", "france", "paris",
  "spain", "madrid", "barcelona", "japan", "tokyo", "china", "shanghai",
  "beijing", "emea", "apac", "latam",
  "uae", "dubai", "israel", "tel aviv", "switzerland", "zurich",
  "sweden", "stockholm", "portugal", "lisbon", "italy", "milan",
  "romania", "ukraine", "vietnam", "indonesia", "malaysia",
  "korea", "seoul", "taiwan", "hong kong", "argentina", "colombia",
  "chile", "peru", "egypt", "nigeria", "kenya", "south africa",
  "new zealand", "austria", "belgium", "denmark", "norway", "finland",
];

function isLikelyUS(locationStr) {
  if (!locationStr) return true; // ambiguous — keep it
  const s = locationStr.toLowerCase();
  return !NON_US_KEYWORDS.some((k) => s.includes(k));
}

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchGreenhouseBoard(board) {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.jobs || [])
    .filter((j) => isLikelyUS(j.location?.name))
    .map((j) => ({
      id: `greenhouse:${board}:${j.id}`,
      company: board,
      title: j.title,
      description: stripHtml(j.content).slice(0, 2000),
      url: j.absolute_url,
      source: "live",
      updated_at: new Date().toISOString(),
    }));
}

async function fetchLeverBoard(board) {
  const res = await fetch(`https://api.lever.co/v0/postings/${board}?mode=json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("unexpected response shape");
  return data
    .filter((j) => isLikelyUS(j.categories?.location))
    .map((j) => ({
      id: `lever:${board}:${j.id}`,
      company: board,
      title: j.text,
      description: stripHtml(j.descriptionPlain || j.description).slice(0, 2000),
      url: j.hostedUrl,
      source: "live",
      updated_at: new Date().toISOString(),
    }));
}

async function fetchAshbyBoard(board) {
  const res = await fetch(
    `https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=false`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const jobs = data.jobs || [];
  return jobs
    .filter((j) => isLikelyUS(j.location) || j.isRemote)
    .map((j) => ({
      id: `ashby:${board}:${j.id}`,
      company: board,
      title: j.title,
      description: stripHtml(j.descriptionHtml || "").slice(0, 2000),
      url: j.jobUrl || j.applyUrl,
      source: "live",
      updated_at: new Date().toISOString(),
    }));
}

async function fetchWorkdayBoard({ company, tenant, wdNumber, site }) {
  const base = `https://${tenant}.${wdNumber}.myworkdayjobs.com`;
  const res = await fetch(`${base}/wday/cxs/${tenant}/${site}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "" }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const postings = data.jobPostings || [];
  return postings
    .filter((j) => isLikelyUS(j.locationsText))
    .map((j) => ({
      id: `workday:${tenant}:${j.bulletFields?.[0] || j.title}`,
      company,
      title: j.title,
      description: "", // Workday's list endpoint doesn't include full descriptions
      url: `${base}/${site}${j.externalPath}`,
      source: "live",
      updated_at: new Date().toISOString(),
    }));
}

async function main() {
  const [greenhouseResults, leverResults, ashbyResults, workdayResults] = await Promise.all([
    Promise.allSettled(GREENHOUSE_BOARDS.map(fetchGreenhouseBoard)),
    Promise.allSettled(LEVER_BOARDS.map(fetchLeverBoard)),
    Promise.allSettled(ASHBY_BOARDS.map(fetchAshbyBoard)),
    Promise.allSettled(WORKDAY_BOARDS.map(fetchWorkdayBoard)),
  ]);

  const allJobs = [];
  let workingCount = 0;

  const report = (results, boards, sourceName, labelFn) => {
    results.forEach((r, i) => {
      const label = labelFn ? labelFn(boards[i]) : boards[i];
      if (r.status === "fulfilled") {
        allJobs.push(...r.value);
        workingCount++;
        console.log(`${sourceName}/${label}: ${r.value.length} US jobs`);
      } else {
        console.warn(`${sourceName}/${label}: skipped — ${r.reason}`);
      }
    });
  };

  report(greenhouseResults, GREENHOUSE_BOARDS, "greenhouse");
  report(leverResults, LEVER_BOARDS, "lever");
  report(ashbyResults, ASHBY_BOARDS, "ashby");
  report(workdayResults, WORKDAY_BOARDS, "workday", (b) => b.company);

  const totalBoards = GREENHOUSE_BOARDS.length + LEVER_BOARDS.length + ASHBY_BOARDS.length + WORKDAY_BOARDS.length;
  console.log(`\n${workingCount} of ${totalBoards} boards returned data.`);

  if (allJobs.length === 0) {
    console.warn("No jobs collected from any board. Nothing to write.");
    return;
  }

  const BATCH = 200;
  for (let i = 0; i < allJobs.length; i += BATCH) {
    const chunk = allJobs.slice(i, i + BATCH);
    const { error } = await supabase.from("jobs").upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error("Upsert error:", error.message);
      process.exitCode = 1;
    }
  }

  console.log(`Done. Wrote ${allJobs.length} US-based jobs to Supabase.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
