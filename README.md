# Runway Data Pipeline

This is the backend that gives Runway real, title-level H1B sponsorship scores
instead of company-wide guesses. It has two scheduled scripts:

- `collect-jobs.js` — pulls live postings from public Greenhouse job boards
- `collect-sponsors.js` — pulls real H1B filing counts per company **and per
  exact job title** from h1bdata.info

Both write into a free Supabase database. GitHub Actions runs them
automatically once a week. Runway's frontend (`runway.html`) reads from that
database instead of calling job boards or h1bdata.info directly from the
browser.

## Setup, step by step

### 1. Create a free Supabase project
1. Go to [supabase.com](https://supabase.com) and sign up (free, no credit card).
2. Click **New project**. Name it `runway`, pick any region, set a database password (save it somewhere).
3. Once it's created, go to **SQL Editor** in the left sidebar.
4. Open `supabase-schema.sql` from this folder, copy all of it, paste it into the SQL Editor, and click **Run**.
5. Go to **Project Settings > API**. You'll need three values from here:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public** key (safe to put in frontend code — it's read-only thanks to the policies in the schema)
   - **service_role** key (secret — only the pipeline uses this, never put it in `runway.html`)

### 2. Create a GitHub repository for the pipeline
1. Go to [github.com/new](https://github.com/new), create a repo named `runway-pipeline` (public or private, either works).
2. Upload every file in this folder to that repo, keeping the folder structure exactly as-is (`scripts/`, `.github/workflows/`, `package.json`, `supabase-schema.sql`).

### 3. Add your Supabase keys as GitHub secrets
1. In your new repo, go to **Settings > Secrets and variables > Actions**.
2. Click **New repository secret** and add:
   - `SUPABASE_URL` → your Project URL from step 1
   - `SUPABASE_SERVICE_KEY` → your service_role key from step 1 (the secret one, not the anon one)

### 4. Run it
1. Go to the **Actions** tab in your repo.
2. Click **Collect Runway data** in the left list, then **Run workflow** to trigger it manually the first time.
3. It takes a few minutes. Check the logs — you should see lines like `Robinhood: total=1079, 269 distinct titles`.
4. After that, it runs automatically every Monday. You can also re-run it manually anytime from the Actions tab.

### 5. Point runway.html at your database
1. Open `runway.html`.
2. Find these two lines near the top of the `<script>` section:
   ```js
   const SUPABASE_URL = "";
   const SUPABASE_ANON_KEY = "";
   ```
3. Fill them in with your Project URL and **anon** key (not the service key) from step 1.
4. Redeploy `runway.html` to Netlify the same way you always do.

That's it. Once this is filled in, every job card on Runway will check whether
that exact job title has real filing history at that exact company, and fall
back to the company-wide score only when it doesn't.

The same setup also turns on the live visitor counter beneath the status
line ("X people have visited Runway"). It counts every real page load from
every visitor, site-wide, not just activity in one browser tab. It's backed
by the `site_visits` table and `increment_visit_count()` function in
`supabase-schema.sql` — both already included when you ran that file in
step 1, so there's nothing extra to set up beyond filling in the two
`SUPABASE_URL` / `SUPABASE_ANON_KEY` lines. Until those are filled in, the
counter line just stays hidden instead of showing a broken or fake number.

## Adding more companies

Edit the `COMPANIES` array at the top of `scripts/collect-sponsors.js`, and
the `GREENHOUSE_BOARDS` array in `scripts/collect-jobs.js`. Push your changes
to GitHub, then trigger the workflow manually once (or wait for the next
Monday run).

## Cost

Free, at this scale. Supabase's free tier covers this easily. GitHub Actions
gives 2,000 free minutes a month on a public repo (private repos get less,
but this workflow only takes a couple of minutes to run weekly).
