// Pulls real H1B LCA filing data from h1bdata.info for each company below,
// broken down by exact job title, and upserts it into Supabase. This is
// what lets Runway score "Data Analyst at Robinhood" differently from
// "Software Engineer at Robinhood" using real filing history instead of a
// single company-wide guess.
//
// Run on a schedule by GitHub Actions, or manually with:
//   npm run collect-sponsors
//
// h1bdata.info has no official API — this parses their public HTML pages.
// If they change their page layout, the regexes below may need updating;
// nothing else in the pipeline depends on their internal markup.

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
// Companies to track. `query` is the exact string sent to h1bdata.info's
// search (their matching is loose but works best with the real legal name).
// `domain` is used for the logo lookup on the frontend.
// Add a row here for every company you add to GREENHOUSE_BOARDS in
// collect-jobs.js, plus any of the Top Sponsors companies you want
// title-level detail for.
// ---------------------------------------------------------------------------
const COMPANIES = [
  { company: "Airbnb", query: "airbnb inc", domain: "airbnb.com" },
  { company: "DoorDash", query: "doordash inc", domain: "doordash.com" },
  { company: "Robinhood", query: "robinhood markets inc", domain: "robinhood.com" },
  { company: "Coinbase", query: "coinbase inc", domain: "coinbase.com" },
  { company: "Stripe", query: "stripe inc", domain: "stripe.com" },
  { company: "GitLab", query: "gitlab inc", domain: "gitlab.com" },
  { company: "Figma", query: "figma inc", domain: "figma.com" },
  { company: "Notion", query: "notion labs inc", domain: "notion.so" },
  { company: "Asana", query: "asana inc", domain: "asana.com" },
  { company: "Discord", query: "discord inc", domain: "discord.com" },
  { company: "Plaid", query: "plaid inc", domain: "plaid.com" },
  { company: "Brex", query: "brex inc", domain: "brex.com" },
];

const RATE_LIMIT_MS = 1500; // be polite between requests
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchCompanyPage(query) {
  const url = `https://h1bdata.info/index.php?em=${encodeURIComponent(query)}&job=&city=&year=ALL+YEARS`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RunwayBot/1.0)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// Parses lines shaped like: "SOFTWARE ENGINEER Median $157,000 284"
// which is how h1bdata.info renders each Job Titles / Employers list item.
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

async function processCompany({ company, query, domain }) {
  const html = await fetchCompanyPage(query);
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");

  // Employers section gives the real legal-entity totals (a company can file
  // under more than one name, e.g. "ROBINHOOD MARKETS INC" + "ROBINHOOD GROUP").
  const employersSection = extractSection(text, "Employers (", "Job Titles (");
  const employerRows = parseTitleLines(employersSection);
  const totalCount = employerRows.reduce((sum, r) => sum + r.count, 0);

  // Job Titles section gives the per-title breakdown we actually want.
  const titlesSection = extractSection(text, "Job Titles (", "Cities (");
  const titleRows = parseTitleLines(titlesSection);

  if (totalCount === 0 && titleRows.length === 0) {
    console.warn(`${company}: no data parsed — page layout may have changed, or no filings found.`);
    return;
  }

  // Company-level total
  const { error: companyError } = await supabase.from("sponsor_companies").upsert(
    {
      company,
      company_query: query,
      domain,
      total_lca_count: totalCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_query" }
  );
  if (companyError) console.error(`${company} company upsert error:`, companyError.message);

  // Per-title rows
  if (titleRows.length > 0) {
    const rows = titleRows.map((r) => ({
      company,
      company_query: query,
      job_title: r.title,
      lca_count: r.count,
      median_salary: r.medianSalary,
      updated_at: new Date().toISOString(),
    }));
    const { error: titlesError } = await supabase
      .from("sponsor_titles")
      .upsert(rows, { onConflict: "company_query,job_title" });
    if (titlesError) console.error(`${company} titles upsert error:`, titlesError.message);
  }

  console.log(`${company}: total=${totalCount}, ${titleRows.length} distinct titles`);
}

async function main() {
  for (const entry of COMPANIES) {
    try {
      await processCompany(entry);
    } catch (err) {
      console.error(`${entry.company}: failed — ${err.message}`);
    }
    await sleep(RATE_LIMIT_MS);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
