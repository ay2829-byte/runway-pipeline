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
// Companies to track. `query` is the exact string sent to h1bdata.info's
// search. Add a row here for every company in collect-jobs.js, plus any
// other major sponsor you want on the Top Sponsors leaderboard even if they
// don't have a public job board.
// ---------------------------------------------------------------------------
const COMPANIES = [
  // --- Job-feed companies (Greenhouse/Lever) ---
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
  { company: "Dropbox", query: "dropbox inc", domain: "dropbox.com" },
  { company: "DocuSign", query: "docusign inc", domain: "docusign.com" },
  { company: "Squarespace", query: "squarespace inc", domain: "squarespace.com" },
  { company: "Twilio", query: "twilio inc", domain: "twilio.com" },
  { company: "Datadog", query: "datadog inc", domain: "datadoghq.com" },
  { company: "Confluent", query: "confluent inc", domain: "confluent.io" },
  { company: "MongoDB", query: "mongodb inc", domain: "mongodb.com" },
  { company: "Elastic", query: "elasticsearch inc", domain: "elastic.co" },
  { company: "Cloudflare", query: "cloudflare inc", domain: "cloudflare.com" },
  { company: "Okta", query: "okta inc", domain: "okta.com" },
  { company: "Zendesk", query: "zendesk inc", domain: "zendesk.com" },
  { company: "Pinterest", query: "pinterest inc", domain: "pinterest.com" },
  { company: "Reddit", query: "reddit inc", domain: "reddit.com" },
  { company: "Snap", query: "snap inc", domain: "snap.com" },
  { company: "Lyft", query: "lyft inc", domain: "lyft.com" },
  { company: "Instacart", query: "maplebear inc", domain: "instacart.com" },
  { company: "Affirm", query: "affirm inc", domain: "affirm.com" },
  { company: "Wise", query: "wise us inc", domain: "wise.com" },
  { company: "Vercel", query: "vercel inc", domain: "vercel.com" },
  { company: "Gusto", query: "gusto inc", domain: "gusto.com" },
  { company: "Rippling", query: "rippling people center inc", domain: "rippling.com" },
  { company: "Deel", query: "deel inc", domain: "deel.com" },
  { company: "Samsara", query: "samsara inc", domain: "samsara.com" },
  { company: "Gong", query: "gong io inc", domain: "gong.io" },
  { company: "Amplitude", query: "amplitude inc", domain: "amplitude.com" },
  { company: "Mixpanel", query: "mixpanel inc", domain: "mixpanel.com" },
  { company: "Segment", query: "segment io inc", domain: "segment.com" },
  { company: "Roblox", query: "roblox corporation", domain: "roblox.com" },
  { company: "Unity", query: "unity technologies", domain: "unity.com" },
  { company: "Snowflake", query: "snowflake computing", domain: "snowflake.com" },
  { company: "Databricks", query: "databricks inc", domain: "databricks.com" },
  { company: "Duolingo", query: "duolingo inc", domain: "duolingo.com" },
  { company: "Grammarly", query: "grammarly inc", domain: "grammarly.com" },
  { company: "Checkr", query: "checkr inc", domain: "checkr.com" },
  { company: "Carta", query: "carta inc", domain: "carta.com" },
  { company: "Opendoor", query: "opendoor labs inc", domain: "opendoor.com" },
  { company: "Flexport", query: "flexport inc", domain: "flexport.com" },
  { company: "Netflix", query: "netflix inc", domain: "netflix.com" },
  { company: "Box", query: "box inc", domain: "box.com" },
  { company: "SendGrid", query: "sendgrid inc", domain: "sendgrid.com" },
  { company: "SoFi", query: "social finance inc", domain: "sofi.com" },
  { company: "Wealthfront", query: "wealthfront corporation", domain: "wealthfront.com" },
  { company: "Thumbtack", query: "thumbtack inc", domain: "thumbtack.com" },

  // --- Major sponsors for the leaderboard (may not have a public job board) ---
  { company: "Amazon", query: "amazon com services llc", domain: "amazon.com" },
  { company: "Google", query: "google llc", domain: "google.com" },
  { company: "Microsoft", query: "microsoft corporation", domain: "microsoft.com" },
  { company: "Meta", query: "meta platforms inc", domain: "meta.com" },
  { company: "Apple", query: "apple inc", domain: "apple.com" },
  { company: "Cognizant", query: "cognizant technology solutions us corp", domain: "cognizant.com" },
  { company: "Infosys", query: "infosys limited", domain: "infosys.com" },
  { company: "Tata Consultancy Services", query: "tata consultancy services limited", domain: "tcs.com" },
  { company: "Deloitte", query: "deloitte consulting llp", domain: "deloitte.com" },
  { company: "Capgemini", query: "capgemini america inc", domain: "capgemini.com" },
  { company: "HCL America", query: "hcl america inc", domain: "hcltech.com" },
  { company: "Accenture", query: "accenture llp", domain: "accenture.com" },
  { company: "JPMorgan Chase", query: "jpmorgan chase & co", domain: "jpmorganchase.com" },
  { company: "Walmart", query: "wal-mart associates inc", domain: "walmart.com" },
  { company: "Intel", query: "intel corporation", domain: "intel.com" },
  { company: "Wipro", query: "wipro limited", domain: "wipro.com" },
  { company: "IBM", query: "international business machines corporation", domain: "ibm.com" },
  { company: "Qualcomm", query: "qualcomm technologies inc", domain: "qualcomm.com" },
  { company: "Tesla", query: "tesla inc", domain: "tesla.com" },
  { company: "Cisco", query: "cisco systems inc", domain: "cisco.com" },
  { company: "Goldman Sachs", query: "goldman sachs & co llc", domain: "goldmansachs.com" },
  { company: "Salesforce", query: "salesforce inc", domain: "salesforce.com" },
  { company: "LinkedIn", query: "linkedin corporation", domain: "linkedin.com" },
  { company: "Oracle", query: "oracle america inc", domain: "oracle.com" },
  { company: "PwC", query: "pricewaterhousecoopers advisory services llc", domain: "pwc.com" },
  { company: "Ernst & Young", query: "ernst & young us llp", domain: "ey.com" },
  { company: "Visa", query: "visa technology & operations llc", domain: "visa.com" },
  { company: "General Motors", query: "general motors company", domain: "gm.com" },
  { company: "Adobe", query: "adobe inc", domain: "adobe.com" },
  { company: "Nvidia", query: "nvidia corporation", domain: "nvidia.com" },
  { company: "Uber", query: "uber technologies inc", domain: "uber.com" },
  { company: "Palantir", query: "palantir technologies inc", domain: "palantir.com" },
  { company: "PayPal", query: "paypal inc", domain: "paypal.com" },
  { company: "eBay", query: "ebay inc", domain: "ebay.com" },
  { company: "ServiceNow", query: "servicenow inc", domain: "servicenow.com" },
  { company: "Capital One", query: "capital one services llc", domain: "capitalone.com" },
  { company: "Bank of America", query: "bank of america na", domain: "bankofamerica.com" },
  { company: "VMware", query: "vmware inc", domain: "vmware.com" },
  { company: "Intuit", query: "intuit inc", domain: "intuit.com" },
  { company: "Comcast", query: "comcast cable communications llc", domain: "comcast.com" },
  { company: "Morgan Stanley", query: "morgan stanley services group inc", domain: "morganstanley.com" },
  { company: "McKinsey & Company", query: "mckinsey & company inc united states", domain: "mckinsey.com" },
  { company: "American Express", query: "american express travel related services company inc", domain: "americanexpress.com" },
  { company: "Advanced Micro Devices", query: "advanced micro devices inc", domain: "amd.com" },
  { company: "T-Mobile", query: "t-mobile usa inc", domain: "t-mobile.com" },
  { company: "KPMG", query: "kpmg llp", domain: "kpmg.com" },
  { company: "Hewlett Packard Enterprise", query: "hewlett packard enterprise company", domain: "hpe.com" },
  { company: "Wells Fargo", query: "wells fargo bank na", domain: "wellsfargo.com" },
  { company: "Bloomberg", query: "bloomberg lp", domain: "bloomberg.com" },
  { company: "Nike", query: "nike inc", domain: "nike.com" },
  { company: "Mastercard", query: "mastercard international inc", domain: "mastercard.com" },
];

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
    const rows = titleRows.map((r) => ({
      company,
      company_query: query,
      job_title: r.title,
      lca_count: r.count,
      median_salary: r.medianSalary,
      updated_at: new Date().toISOString(),
    }));
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

  const { error: companyError } = await supabase.from("sponsor_companies").upsert(
    {
      company,
      company_query: query,
      domain,
      total_lca_count: recentTotal,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_query" }
  );
  if (companyError) console.error(`${company} company upsert error:`, companyError.message);

  console.log(`${company}: FY24+25=${recentTotal} (2024=${total2024}, 2025=${total2025}), ${titleRows.length} distinct titles (all-time)`);
}

async function main() {
  let ok = 0;
  for (const entry of COMPANIES) {
    try {
      await processCompany(entry);
      ok++;
    } catch (err) {
      console.error(`${entry.company}: failed — ${err.message}`);
    }
    await sleep(RATE_LIMIT_MS);
  }
  console.log(`\nDone. ${ok} of ${COMPANIES.length} companies processed successfully.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
