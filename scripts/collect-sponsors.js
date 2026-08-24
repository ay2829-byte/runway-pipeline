// Pulls real H1B LCA filing data from h1bdata.info for every company below.
// Two different things get written:
//
// 1. sponsor_titles — ALL-TIME per-title filing counts, used by runway.html
//    to score a specific job title at a specific company (e.g. "Data
//    Analyst at Robinhood"). All-time data is used here because more
//    history makes for a more stable read on which roles a company
//    actually sponsors, and this isn't shown to users as a "this year"
//    number, it's a matching signal.
//
// 2. sponsor_companies — a REAL FY2024 + FY2025 total per company, fetched
//    by querying h1bdata.info for each of those two years separately and
//    summing. This is what the Top Sponsors leaderboard displays, and it's
//    deliberately recent-only rather than all-time, per how that tab is
//    described on the site.
//
// Run on a schedule by GitHub Actions, or manually with:
//   npm run collect-sponsors
//
// h1bdata.info has no official API — this parses their public HTML pages.
// A company that doesn't match their exact indexed name just gets skipped
// with a warning, it doesn't fail the whole run.

import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ---------------------------------------------------------------------------
// Company list now comes from company-list.js, shared with collect-jobs.js.
// This is the fix for a real bug: the job board list and this sponsor list
// used to be maintained separately and drifted apart, so most jobs had no
// matching sponsor data and fell back to the same generic score regardless
// of company. Every company that produces jobs now automatically gets a
// sponsor-data lookup attempt too.
// ---------------------------------------------------------------------------
import { buildSponsorCompanyList } from "./company-list.js";
const COMPANIES = buildSponsorCompanyList();


const RATE_LIMIT_MS = 1200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(query, year) {
  const yearParam = year ? String(year) : "ALL+YEARS";
  const url = `https://h1bdata.info/index.php?em=${encodeURIComponent(query)}&job=&city=&year=${yearParam}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RunwayBot/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function parseTitleLines(text) {
  const rows = [];
  const re = /([A-Z0-9 &,.\-'’"]+?)\s+Median\s+\$([\d,]+)\s+(\d+)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    rows.push({
      title: m[1].trim(),
      medianSalary: parseInt(m[2].replace(/,/g, ""), 10),
      count: parseInt(m[3], 10),
    });
  }
  return rows;
}

function extractSection(fullText, startLabel, endLabel) {
  const start = fullText.indexOf(startLabel);
  if (start === -1) return "";
  const end = endLabel ? fullText.indexOf(endLabel, start) : -1;
  return end === -1 ? fullText.slice(start) : fullText.slice(start, end);
}

function totalFromEmployersSection(html) {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const employersSection = extractSection(text, "Employers (", "Job Titles (");
  const rows = parseTitleLines(employersSection);
  return rows.reduce((sum, r) => sum + r.count, 0);
}

async function processCompany({ company, query, domain }) {
  // 1. All-time title breakdown, for job-level scoring.
  const allTimeHtml = await fetchPage(query, null);
  const $ = cheerio.load(allTimeHtml);
  const text = $("body").text().replace(/\s+/g, " ");
  const titlesSection = extractSection(text, "Job Titles (", "Cities (");
  const titleRows = parseTitleLines(titlesSection);

  if (titleRows.length > 0) {
    // De-duplicate by (company, job_title) before upserting. Without this,
    // if the same title appears twice in a single scrape (overlapping
    // parsed sections do happen), Postgres rejects the whole batch with
    // "ON CONFLICT DO UPDATE command cannot affect row a second time" —
    // it refuses to update the same row twice within one statement.
    const dedupedMap = new Map();
    for (const r of titleRows) {
      const key = `${query}|${r.title}`;
      const existing = dedupedMap.get(key);
      if (!existing || r.count > existing.lca_count) {
        dedupedMap.set(key, {
          company,
          company_query: query,
          job_title: r.title,
          lca_count: r.count,
          median_salary: r.medianSalary,
          updated_at: new Date().toISOString(),
        });
      }
    }
    const rows = Array.from(dedupedMap.values());
    const { error } = await supabase
      .from("sponsor_titles")
      .upsert(rows, { onConflict: "company_query,job_title" });
    if (error) console.error(`${company} titles upsert error:`, error.message);
  }

  await sleep(RATE_LIMIT_MS);

  // 2. Real FY2024 + FY2025 total, for the Top Sponsors leaderboard.
  const [html2024, html2025] = await Promise.all([
    fetchPage(query, 2024).catch(() => null),
    fetchPage(query, 2025).catch(() => null),
  ]);
  const total2024 = html2024 ? totalFromEmployersSection(html2024) : 0;
  const total2025 = html2025 ? totalFromEmployersSection(html2025) : 0;
  const recentTotal = total2024 + total2025;

  if (recentTotal === 0 && titleRows.length === 0) {
    console.warn(`${company}: no data parsed at all — query may not match h1bdata.info's indexed name.`);
    return;
  }

  // onConflict must target "company", not "company_query" — the actual
  // unique constraint in supabase-schema.sql is on the company column.
  // Using a column with no matching constraint makes Postgres reject
  // every single write with "no unique or exclusion constraint matching
  // the ON CONFLICT specification" — which is exactly what was happening,
  // silently, for all 231 companies on every previous run.
  const { error: companyError } = await supabase.from("sponsor_companies").upsert(
    {
      company,
      company_query: query,
      domain,
      total_lca_count: recentTotal,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company" }
  );
  if (companyError) console.error(`${company} company upsert error:`, companyError.message);

  console.log(`${company}: FY24+25=${recentTotal} (2024=${total2024}, 2025=${total2025}), ${titleRows.length} distinct titles (all-time)`);

  return !companyError; // whether the database actually accepted this write
}

async function main() {
  let ok = 0;
  let dbErrors = 0;
  for (const entry of COMPANIES) {
    try {
      const wrote = await processCompany(entry);
      if (wrote) ok++; else dbErrors++;
    } catch (err) {
      console.error(`${entry.company}: failed — ${err.message}`);
    }
    await sleep(RATE_LIMIT_MS);
  }
  console.log(`\nDone. ${ok} of ${COMPANIES.length} companies actually written to the database.`);
  if (dbErrors > 0) {
    console.error(`${dbErrors} companies had a database write error — check the "upsert error" lines above.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
