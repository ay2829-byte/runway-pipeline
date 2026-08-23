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

// ---------------------------------------------------------------------------
// Greenhouse boards. Token is the slug in boards-api.greenhouse.io/v1/boards/{token}/jobs
// ---------------------------------------------------------------------------
const GREENHOUSE_BOARDS = [
  "airbnb", "doordash", "robinhood", "coinbase", "stripe", "gitlab",
  "figma", "notion", "asana", "discord", "plaid", "brex",
  "dropbox", "docusign", "squarespace", "twilio", "datadog", "confluent",
  "mongodb", "elastic", "cloudflare", "okta", "zendesk", "pinterest",
  "reddit", "snap", "lyft", "instacart", "affirm", "chime", "wise",
  "ramp", "mercury", "vercel", "netlify", "retool", "airtable", "webflow",
  "gusto", "rippling", "deel", "remote", "benchling", "samsara", "gong",
  "amplitude", "mixpanel", "segment", "sourcegraph", "scale",
  "roblox", "unity", "snowflake", "databricks", "duolingo",
  "grammarly", "vanta", "drata", "checkr", "lattice", "cultureamp",
  "carta", "opendoor", "flexport", "faire", "attentive",
  "clickhouse", "temporal", "render", "fivetran", "hex", "census",
  "posthog", "loom", "calendly",
  "asaptext", "brightwheel", "clari", "clio", "coalitioninc",
  "cockroachlabs", "contentsquare", "coursera", "customerio", "degreed",
  "docker", "earnin", "envoy", "figure", "flywire", "gemini",
  "greenlightcard", "guideline", "homelight", "hopin", "iterable",
  "june", "justworks", "kandji", "klaviyo", "lambdaschool",
  "lucidmotors", "matterport", "nextroll", "oportun", "outreach",
  "papaya-global", "pilot", "podium", "postman", "quizlet",
  "recharge", "relativity", "roofstock", "rover", "sardine",
  "seatgeek", "shipbob", "sisense", "sittercity", "smartrecruiters",
  "snyk", "sprig", "streak", "superhuman", "talkdesk",
  "the-farmers-dog", "toast", "underdogfantasy", "verkada", "vetster",
  "whoop", "wyze", "zapier", "zocdoc",
];

// ---------------------------------------------------------------------------
// Lever boards. Public API: api.lever.co/v0/postings/{token}?mode=json
// ---------------------------------------------------------------------------
const LEVER_BOARDS = [
  "netflix", "anduril", "eventbrite", "yelp", "box", "sendgrid",
  "patreon", "articulate", "betterup", "shipt",
  "clearbit", "runwayml", "genies", "highspot", "narvar",
  "outschool", "sofi", "tala", "wealthfront", "thumbtack", "nextdoor",
];

// ---------------------------------------------------------------------------
// Ashby boards. Public API: api.ashbyhq.com/posting-api/job-board/{token}
// A newer ATS than Greenhouse/Lever, so this list is less certain — these
// are best-effort guesses at company slugs, not all verified. Same
// graceful-failure handling applies: wrong ones just get skipped.
// ---------------------------------------------------------------------------
const ASHBY_BOARDS = [
  "linear", "substack", "clay", "mercor", "replit", "watershed",
  "modal", "cohere", "assemblyai", "opengov", "middesk",
  "ramp", "notion", "vanta", "webflow", "retool", "deel",
  "ironclad", "ledger", "perplexity-ai", "cursor", "descript",
  "grafana-labs", "hightouch", "pave", "sardine", "airbyte",
  "chronosphere", "dagster-labs", "braintrust-data", "common-room",
];

// ---------------------------------------------------------------------------
// Workday boards. Unlike the three above, Workday has no simple "company
// name as slug" pattern — each company's career site runs on a specific
// server number (wd1, wd3, wd5...), tenant ID, and site name, none of
// which are guessable from the company name. Getting one of these wrong
// just returns zero results rather than an error, so this list only has a
// couple of entries I'm reasonably confident in, plus instructions below
// for adding more yourself — it only takes a minute per company.
//
// HOW TO FIND THESE VALUES FOR A NEW COMPANY:
//   1. Open the company's careers page. If they use Workday, the page
//      (or a redirect) will load a URL containing myworkdayjobs.com.
//   2. Open browser dev tools (F12), go to the Network tab, reload the
//      page, and filter for "jobs".
//   3. Find the POST request to a URL shaped like:
//      https://COMPANY.wd5.myworkdayjobs.com/wday/cxs/COMPANY/SITE/jobs
//   4. From that URL: wdNumber = "wd5", tenant = "COMPANY" (right after
//      https://), site = "SITE" (the segment right before "/jobs" —
//      varies a lot, e.g. "External", "Careers", "External_Career_Site").
// ---------------------------------------------------------------------------
const WORKDAY_BOARDS = [
  { company: "comcast", tenant: "comcast", wdNumber: "wd5", site: "Comcast_Careers", domain: "comcast.com" },
  { company: "cisco", tenant: "cisco", wdNumber: "wd5", site: "Cisco_Careers", domain: "cisco.com" },
  { company: "nike", tenant: "nike", wdNumber: "wd1", site: "nke", domain: "nike.com" },
  { company: "salesforce", tenant: "salesforce", wdNumber: "wd12", site: "External_Career_Site", domain: "salesforce.com" },
];

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
