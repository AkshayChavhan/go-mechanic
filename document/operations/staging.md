# Staging: a private copy of the site on the internet

Staging is the website built from `main`, on Vercel, with its database on Supabase in Mumbai. Only you (logged in to Vercel) and people with the one share link can open it. Login codes still come from the fake SMS provider: you read them in Supabase.

Plan and reasons: [2026-11-03-0851-feat-staging-deploy-plan.md](../plans/2026-11-03-0851-feat-staging-deploy-plan.md).

**Rules that keep it safe**

- Secrets (the database password, `BETTER_AUTH_SECRET`) go only into the Vercel and Supabase dashboards and into `.env.staging` on your laptop. Never into git, a chat, or `.env.local`.
- The staging database is changed only from an up-to-date `main` (the scripts refuse anything else).
- Dashboard labels change over time. If a screen doesn't match these steps, look for the closest label and fix this page.

---

## 1. Supabase: the database

1. Sign in at [supabase.com](https://supabase.com). Turn on two-factor login first: your avatar, **Account preferences**, **Multi-factor authentication**. This login can read every login code on staging.
2. **New project**. Name `gomechanic-staging`, region **South Asia (Mumbai)**, plan **Free**. Generate a strong database password and keep it in your password manager.
3. Turn off the Data API, so nobody can read the tables over the internet (our tables have no row-level security): **Project Settings**, **Data API**, switch **Enable Data API** off, and save.
4. Get the two addresses: **Connect** (top of the project page).
   - **Session pooler** (port **5432**, host ending in `pooler.supabase.com`): for the scripts on your laptop.
   - **Transaction pooler** (port **6543**): for Vercel.
   Put your password in each. If the password has `/`, `?`, `#`, `@` or `%`, percent-encode them (`%2F`, `%3F`, `%23`, `%40`, `%25`).
5. In the project folder on your laptop, create `.env.staging` (git ignores it) with one line, the **session pooler** address:

   ```bash
   STAGING_DATABASE_URL=postgresql://postgres.<project>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
   ```

## 2. Laptop: migrate and seed

From an up-to-date `main` (`git switch main && git pull --ff-only origin main`). During task 20 itself, from the `20_staging_deploy` branch: its migrations and seed data equal `main`'s, and the scripts check that.

```bash
npm run staging:migrate   # applies main's migrations, then checks every one is there unchanged
npm run staging:seed      # adds the garage, slot rules and vehicle catalogue rows staging is missing
```

Each prints one or two lines. `staging:seed` also lists rows that differ from `main`'s seed data (see section 5).

## 3. Vercel: the site

The order matters: the site must be protected before it first works.

1. Sign in at [vercel.com](https://vercel.com) (plan **Hobby**). Turn on two-factor login first: **Account Settings**, **Authentication**. This account holds staging's secrets.
2. **Add New**, **Project**, import the GitHub repository `go-mechanic`. **Don't add any environment variables yet.** Deploy. This first build fails on purpose ("APP_ENV can't be local on Vercel"): nothing is public.
3. **Settings**, **Deployment Protection**: **Vercel Authentication** on, scope **All Deployments** (the default, "Standard Protection", would leave the production address public). Save.
4. **Settings**, **Git**, **Ignored Build Step**: **Only build production**. Three Claude sessions push branches; this stops each push from building.
5. **Settings**, **Environments**, **Production**, **Branch Tracking**: during task 20, `20_staging_deploy` (it has the database code `main` doesn't have yet). After the task merges: `main`.
6. **Settings**, **Environment Variables**, environment **Production** only (leave Preview and Development empty), type **Secret** where offered:

   | Name | Value |
   | --- | --- |
   | `APP_ENV` | `staging` |
   | `DATABASE_URL` | the **transaction pooler** address (port 6543) |
   | `BETTER_AUTH_SECRET` | the output of `openssl rand -base64 32`, run on your laptop |
   | `OWNER_PHONE_NUMBER` | your mobile, as `+91` and 10 digits |
   | `SMS_PROVIDER` | `fake` |

7. **Deployments**, the latest one, **Redeploy**. The build first runs `npm run staging:check`, then builds the site. The region (Mumbai, `bom1`) comes from `vercel.json`: no setting for it here.
8. Open the site's address in a private browser window: you must see Vercel's login page, not the site.

## 4. Testers

- **Getting in:** **Deployment Protection**, **Shareable Links**: create the link and send it. Hobby allows one. Anyone with it gets in; revoking it locks everyone out until you send a new one.
- **Logging in:** testers use made-up numbers starting `60000` (not their own). After they ask for a code, open Supabase, **Table Editor**, `dev_messages`, sort by `created_at` newest first, and send them the code for their number. Messages stay up to 48 hours.
- **You:** log in with `OWNER_PHONE_NUMBER` to get the owner role (shown on `/account`).

## 5. After each merge into `main`

Vercel builds `main` by itself. The build starts with `staging:check`, which fails, with the reason, when:

- **A migration isn't applied** (a merged task added one): from up-to-date `main`, run `npm run staging:migrate`, then **Redeploy** in Vercel.
- **A seed row is missing:** run `npm run staging:seed`, then **Redeploy**.
- **A seed row differs from `main`'s seed data** (someone corrected the catalogue or the slot capacity in code): seeding never changes an existing row, so write a data migration (a new SQL migration that updates those rows), merge it, then run `staging:migrate`.

Change tables in two steps: add the new column or table in one migration, and drop the old one in a later one. Until the next build finishes, the previous deployment keeps serving against the already-migrated database.

Rows you change in Supabase's console reach the pages only after a **Redeploy**: the site caches what it reads (`cacheLife("max")`).

## 6. Proof that a slot is never overbooked

```bash
npm run staging:race-test
```

Fires 10 reservations at once at slots in June 2099, through 10 separate connections, and deletes only those rows afterwards. A deliberately wrong version must overbook under the same load, or the test means nothing.

## When something goes wrong

| What you see | Why | What to do |
| --- | --- | --- |
| Build fails at `staging:check` | The database is behind `main`, or a seed row differs | Section 5 |
| Pages error, or the check can't connect | Supabase paused the project after 7 days of low activity | Supabase, the project, **Restore**, then **Redeploy** |
| `staging:migrate` refuses port 6543 | `.env.staging` has the transaction pooler | Use the **session pooler** address (port 5432) |
| "is not a valid Postgres URL" | A special character in the password isn't encoded | Percent-encode it (section 1, step 4) |
| "...is not set" / a setting named by `serverEnv()` | A Vercel variable is missing | Section 3, step 6, then **Redeploy** |
| "These differ from origin/main" | You're not on an up-to-date `main` | `git switch main && git pull --ff-only origin main` |
| "max clients reached in Session mode" | The session pooler's pool is full | Wait a minute and retry; or **Database**, **Connection pooling**, raise **Pool Size** |
| A branch built on Vercel | Ignored Build Step isn't "Only build production" | Section 3, step 4; delete the preview |

## Undo

- **Rotate the database password:** Supabase, **Project Settings**, **Database**, **Reset database password**. Then update `.env.staging` and Vercel's `DATABASE_URL`, and **Redeploy**.
- **Rotate `BETTER_AUTH_SECRET`:** a new `openssl rand -base64 32` value in Vercel, then **Redeploy**. Everyone is logged out.
- **Cut off testers:** revoke the Shareable Link.
- **Take staging down:** delete the Vercel project (**Settings**, **Advanced**, **Delete Project**), then the Supabase project (**Project Settings**, **General**, **Delete project**). Delete `.env.staging`.
