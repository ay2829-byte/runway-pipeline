// Single source of truth for which companies Runway tracks. Both
// collect-jobs.js and collect-sponsors.js import from this file instead of
// keeping their own separate lists. This exists specifically because those
// two lists drifted apart before: the job board list grew to ~190
// companies while the sponsor-tracking list stayed at ~100, so most jobs
// had no sponsor data to score against at all and fell back to the same
// generic "Unverified" score regardless of company. Adding a company here
// once means it's automatically covered for both live postings and real
// H1B filing data — no more separate lists to keep in sync by hand.

// ---------------------------------------------------------------------------
// Job board sources. Token is the URL slug each platform uses.
// ---------------------------------------------------------------------------
export const GREENHOUSE_BOARDS = [
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
  "1password", "abnormalsecurity", "airbyte", "algolia", "anduril",
  "arctic-wolf", "arize-ai", "assemblyai", "atlan", "aurorasolar",
  "axoni", "bilt", "bird", "blend", "bolt",
  "branch", "brightline", "bubble", "buildkite", "bunq",
  "cameo", "canva", "capchase", "cased", "cedar",
  "cerebras", "chainalysis", "chargebee", "cimpress", "clearcover",
  "clover-health", "clutter", "commure", "consensys", "corelogic",
  "cover-genius", "cresta", "cribl", "crusoe-energy", "current",
  "daily", "dandy", "dbt-labs", "decagon", "devoted-health",
  "dialpad", "divvy-homes", "doma", "doximity", "eightsleep",
  "epic-games", "everlaw", "eyeo", "faraday", "fireblocks",
  "flock-safety", "forter", "frontapp", "frontdoor", "gametime",
  "gemini-trust", "geniushub", "getaround", "gitbook", "glean",
  "goodleap", "grafana", "hebbia", "hellosign", "hinge-health",
  "honeycomb", "hopper", "human-interest", "iheartmedia", "imperva",
  "included-health", "insider-intelligence", "invisible", "iterable-inc", "jerry",
  "jumio", "kalepa", "keeper-security", "khan-academy", "kikoff",
  "labelbox", "lacework", "landing", "leapyear", "lemonade",
  "level", "lightmatter", "lightspeed", "linktree", "livongo",
  "lob", "lucid-software", "luminai", "lyra-health", "magic-eden",
  "mainstreet", "mark43", "matician", "maven-clinic", "medable",
  "mercari", "meter", "mindbody", "monte-carlo-data", "moveworks",
  "narmi", "netskope", "newfront", "nomi-health", "notarize",
  "nova-credit", "nuna", "octane", "orbital-insight", "oscar-health",
  "outschool-inc", "owner", "papa", "patch", "peloton",
  "personio", "pilot-com", "pinwheel", "podium-inc", "prelude",
  "prezi", "prosperworks", "pulley", "quorum", "railsr",
  "reforge", "relay-payments", "revolut", "riverside", "roon",
  "rula", "sana-labs", "savvy", "seismic", "sentilink",
  "shield-ai", "sigma-computing", "signifyd", "sisu", "skydio",
  "smallpdf", "sondermind", "sourcepoint", "spring-health", "spruce",
  "standard-cognition", "starburst-data", "statsig", "stord", "storyblocks",
  "strive-health", "sunbit", "sword-health", "synapse", "synthego",
  "teachable", "tempus-labs", "tesorio", "thatgamecompany", "thoughtspot",
  "tigergraph", "titan-invest", "tomo", "tovala", "truveta",
  "tulip", "turing", "turo", "typeface", "upgrade",
  "vanmoof", "vention", "vice-media", "virtuous", "vivun",
  "voleon", "wave-hq", "weride", "whatnot", "wonderschool",
  "workato", "xero", "yipitdata", "zeitview", "zenoti",
];

export const LEVER_BOARDS = [
  "netflix", "anduril", "eventbrite", "yelp", "box", "sendgrid",
  "patreon", "articulate", "betterup", "shipt",
  "clearbit", "runwayml", "genies", "highspot", "narvar",
  "outschool", "sofi", "tala", "wealthfront", "thumbtack", "nextdoor",
  "buzzfeed", "clutch", "collective-health", "cortex", "dstillery",
  "eventbase", "grove-collaborative", "handshake", "hopper-inc", "hubble",
  "iheart", "jerry-ai", "kickstarter", "letgo", "lulus",
  "medallia", "myfitnesspal", "nextdoor-inc", "opencare", "peerspace",
  "picsart", "quizlet-inc", "sharethrough", "sittercity-inc", "sunrun",
  "tovala-inc", "upstart", "vsco", "wag", "zeta-global",
];

export const ASHBY_BOARDS = [
  "linear", "substack", "clay", "mercor", "replit", "watershed",
  "modal", "cohere", "assemblyai", "opengov", "middesk",
  "ramp", "notion", "vanta", "webflow", "retool", "deel",
  "ironclad", "ledger", "perplexity-ai", "cursor", "descript",
  "grafana-labs", "hightouch", "pave", "sardine", "airbyte",
  "chronosphere", "dagster-labs", "braintrust-data", "common-room",
  "abridge", "arc", "baseten", "cartwheel", "clado",
  "coder", "decagon-ai", "deepgram", "eleven-labs", "fal",
  "gamma", "harvey-ai", "imprint", "instabase", "kalshi",
  "legora", "lovable", "luminai-inc", "mainstay", "n8n",
  "observe-ai", "polytomic", "resend", "rows", "runreveal",
  "sierra", "supabase", "unstructured", "vanta-inc", "vellum",
  "warp", "writer", "zed-industries",
];

// Workday needs three exact values per company (not guessable from the
// name), so this only has entries verified against real posting URLs.
export const WORKDAY_BOARDS = [
  { company: "comcast", tenant: "comcast", wdNumber: "wd5", site: "Comcast_Careers", domain: "comcast.com" },
  { company: "cisco", tenant: "cisco", wdNumber: "wd5", site: "Cisco_Careers", domain: "cisco.com" },
  { company: "nike", tenant: "nike", wdNumber: "wd1", site: "nke", domain: "nike.com" },
  { company: "salesforce", tenant: "salesforce", wdNumber: "wd12", site: "External_Career_Site", domain: "salesforce.com" },
  { company: "qualcomm", tenant: "qualcomm", wdNumber: "wd12", site: "External", domain: "qualcomm.com" },
];

// ---------------------------------------------------------------------------
// Better-than-generic h1bdata.info query strings for companies where the
// obvious "{name} inc" guess wouldn't match their actual filing name.
// Anything not listed here falls back to that generic guess in
// buildSponsorCompanyList() below.
// ---------------------------------------------------------------------------
const QUERY_OVERRIDES = {
  robinhood: "robinhood markets inc",
  notion: "notion labs inc",
  instacart: "maplebear inc",
  wise: "wise us inc",
  rippling: "rippling people center inc",
  gong: "gong io inc",
  segment: "segment io inc",
  roblox: "roblox corporation",
  unity: "unity technologies",
  snowflake: "snowflake computing",
  opendoor: "opendoor labs inc",
  sofi: "social finance inc",
  wealthfront: "wealthfront corporation",
  elastic: "elasticsearch inc",
  qualcomm: "qualcomm technologies inc",
};

// ---------------------------------------------------------------------------
// Major sponsors worth tracking on the Top Sponsors leaderboard even though
// they don't have a public job board Runway pulls postings from. Query
// strings here are real, verified legal-entity names from DOL disclosure
// data, not guesses.
// ---------------------------------------------------------------------------
export const EXTRA_SPONSOR_COMPANIES = [
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
  { company: "Goldman Sachs", query: "goldman sachs & co llc", domain: "goldmansachs.com" },
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
  { company: "Morgan Stanley", query: "morgan stanley services group inc", domain: "morganstanley.com" },
  { company: "McKinsey & Company", query: "mckinsey & company inc united states", domain: "mckinsey.com" },
  { company: "American Express", query: "american express travel related services company inc", domain: "americanexpress.com" },
  { company: "Advanced Micro Devices", query: "advanced micro devices inc", domain: "amd.com" },
  { company: "T-Mobile", query: "t-mobile usa inc", domain: "t-mobile.com" },
  { company: "KPMG", query: "kpmg llp", domain: "kpmg.com" },
  { company: "Hewlett Packard Enterprise", query: "hewlett packard enterprise company", domain: "hpe.com" },
  { company: "Wells Fargo", query: "wells fargo bank na", domain: "wellsfargo.com" },
  { company: "Bloomberg", query: "bloomberg lp", domain: "bloomberg.com" },
  { company: "Mastercard", query: "mastercard international inc", domain: "mastercard.com" },
];

// Builds the full list collect-sponsors.js processes: every job-board
// company (using a curated query override if one exists, otherwise a
// generic "{name} inc" guess) plus the extra major sponsors above.
export function buildSponsorCompanyList() {
  const seen = new Set();
  const list = [];

  const addBoardCompany = (name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    list.push({
      company: name,
      query: QUERY_OVERRIDES[key] || `${name} inc`,
      domain: `${name.replace(/[\s-]+/g, "")}.com`,
    });
  };

  GREENHOUSE_BOARDS.forEach(addBoardCompany);
  LEVER_BOARDS.forEach(addBoardCompany);
  ASHBY_BOARDS.forEach(addBoardCompany);
  WORKDAY_BOARDS.forEach((w) => addBoardCompany(w.company));

  EXTRA_SPONSOR_COMPANIES.forEach((e) => {
    const key = e.company.toLowerCase();
    if (seen.has(key)) return; // a board entry with the same name already added
    seen.add(key);
    list.push(e);
  });

  return list;
}
