# 19_info_pages: contact, about, FAQ, and draft privacy and terms pages

> **Branch:** `19_info_pages` · **Date:** 2026-10-29 · **Status:** In progress (ready for review)

## In one minute

The site now has five more public pages. `/contact` has the address, the opening hours with the live open/closed badge, Call and WhatsApp. `/about` says what the garage is, `/faq` answers common questions, and `/privacy` and `/terms` are drafts of the legal pages. About and Contact are in the menu; FAQ, Privacy and Terms are in the footer. The login's short notice now links the privacy notice, so the consent version moved to `2026-10-29`.

The rule that shaped everything: **a page only states facts the owner confirmed or the database holds.** The garage's story, team, warranty, parts and job times aren't known yet, so they show only under `npm run dev`, as labelled samples, and never in a build anyone else sees.

Full details: [the plan](../plans/2026-10-29-1118-feat-info-pages-plan.md) (R1–R12, KTD1–KTD9, units U1–U8).

**Built in parallel.** Three Claude sessions worked at once, each in its own folder (git worktree) on its own branches: Session 1 in `go-mechanic` (tasks 15, 16 …), Session 2 in `go-mechanic-s2` (task 17 …), and this one, Session 3, in `go-mechanic-s3`. To avoid merge conflicts, this task added new message namespaces in the middle of `messages/en.json` (not at the end, where others append), and put its notes for later tasks at the end of the task.md backlog instead of in their step lists.

**The merge.** Near the end, tasks 16 (roles) and 17 (vehicle catalogue) reached `main`, so `git merge origin/main` brought them in (`9ccaa03`). Three files conflicted, each because both sides added text at the same spot. `CLAUDE.md`: both changed the same repo-map rows and login bullets. `task.md`: both added backlog lines. `messages/en.json`: both added namespaces just before `NotFound`. Each conflict kept both sides, with `main`'s text where it was and this task's after it. Then the privacy coverage test failed: task 17 had added three tables (`vehicle_categories`, `vehicle_makes`, `vehicle_models`). That's the test doing its job. They hold the garage's list of vehicles, not anyone's own, so they're listed as `null`. `npm run check` passed again: 95 files, 1442 tests.

## Why: the problem we solved

A visitor couldn't find "where are you, when are you open, how do I pay, what do you do with my number?". The menu had About and Contact, hidden because their pages didn't exist. The login asked for consent with a two-line notice and nowhere to read more. India's DPDP Act (2023) and its Rules (2025) ask for a full, standalone notice before their duties start (about May 2027).

The owner answered four questions on 2026-10-29:

- No directions link or map yet: a link built from the address lands at Mukai Chowk, not the garage.
- The breakdown number is the garage's own phone.
- Payment at the garage is cash or UPI.
- Unknown facts are labelled samples, shown under `npm run dev` only.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `src/app/[locale]/(site)/contact/`, `about/`, `faq/`, `privacy/`, `terms/` | Added | The five pages and their tests |
| `src/app/[locale]/(site)/privacy/coverage.test.ts` | Added | Lists every database table against the privacy notice; fails when a new one appears |
| `src/app/[locale]/(site)/_components/page-tones.ts` | Added | Picks section tones from how many sections a page shows |
| `src/app/[locale]/(site)/_components/contact-rich-text.tsx` | Added | The call and WhatsApp links inside sentences, shared by contact, FAQ and terms |
| `src/content/about.ts`, `faq.ts` | Added | The unconfirmed facts as samples, each with a "canary" phrase, read only through selectors |
| `src/lib/samples.ts`, `src/content/home.ts` | Changed | `realOrSamples()` moved here, shared by all three content files |
| `src/components/site/navigation.ts`, `site-footer.tsx`, `site-chrome.tsx` | Changed | About and Contact go live; a footer-only list (FAQ, Privacy, Terms) |
| `src/app/[locale]/dev/design/page.tsx` | Changed | The footer sample shows the new links |
| `src/app/[locale]/login/page.tsx`, `src/components/account/login-form.tsx` | Changed | The notice links `/privacy` in a new tab |
| `src/domain/consent.ts`, `consent.test.ts` | Changed | Version `2026-10-29`; `PRIVACY_NOTICE_VALUES` (the hours, minutes and days the notice states, taken from `LOGIN_RULES`); the test now pins a fingerprint of the privacy notice too |
| `messages/en.json` | Changed | `ContactPage`, `AboutPage`, `FaqPage`, `PrivacyPage`, `TermsPage`, three `Nav` labels, the new notice |
| `e2e/info-pages.spec.ts` | Added | The five pages on the production build |
| `CLAUDE.md`, `document/task/task.md` | Changed | Repo map, the privacy-notice rule, notes for tasks 23, 40, 42, 43 |

## How: step by step

1. **Ask the owner first.** Four facts the pages needed (see Why), recorded in task.md.
2. **Plan with `ce-plan`, check with `ce-doc-review`.** The research found the privacy notice would have been wrong in two places. Sessions keep the full IP address and browser type until logout, not 48 hours. Old login attempts are deleted only when someone next asks for a code, not on a timer. The reviews also changed the contact page's buttons: one blue Call, a plain WhatsApp chat, and no Book button.
3. **U1, the samples.** `about.ts` and `faq.ts` copy the home page's pattern: real data (`null` today), samples, and a selector that returns real data in every build, samples under `npm run dev`, or nothing.
4. **U2–U5, the pages.** Each is an async Server Component that reads the garage with `readGarage()` (cached), exports `ensureStatic = "navigation"` (the build fails if it ever reads per-request data), and has its own title and description. Each page's `live` flag flipped in the same commit as the page, because `navigation.test.ts` checks the flags against the real `page.tsx` files.
5. **U6, the login notice.** Notice text, version bump and pinned wording went into one commit. The privacy link opens in a new tab: the login form's number and ticked boxes live only in that page.
6. **U7, the browser tests**, then a look at every page on a production build and under `npm run dev`, at 375 px and 1440 px:
   ```bash
   npm start -- --port 3002        # the production build from test:e2e; samples hidden
   npm run dev -- --port 3002      # samples shown, each with its Sample badge
   ```
   Port 3002 is this session's; 3000 is Session 1's.

## New ideas in this task

- **Canary phrase:** a made-up phrase that appears in one sample only ("older than our first spanner"). The browser tests search the production build's HTML, page data and scripts for it: finding it means a sample leaked.
- **Rich text in messages:** `"The <privacy>privacy notice</privacy> has the details."` keeps the words in `messages/en.json`, and the page decides what `<privacy>` becomes (`t.rich("notice", { privacy: (chunks) => <Link …> })`).
- **Fingerprint:** a SHA-256 hash of the privacy notice's text and the numbers it fills in ("48 hours", "5 minutes", "30 days"). `consent.test.ts` pins it, so changing either fails the test until the consent version moves. A full copy of the notice would be a page long. The numbers count too: a change to `LOGIN_RULES` changes what the notice says without touching its wording.
- **noindex:** `robots: { index: false }` in a page's metadata asks search engines not to list it. Used on the two drafts until task 43.

## Check that it works

```bash
npm run check      # lint, types and unit tests
npm run test:e2e   # the production build; e2e/info-pages.spec.ts covers these pages
```

Results so far: `npm run check` passed with 84 files and 1278 tests, and `npm run test:e2e` passed 88 of 88 (2.8 minutes). The guard checks were each run once with the code broken on purpose: removing a table from `coverage.test.ts`'s list made it fail with a message naming the table.

## Common mistakes

- **Letting a pipe hide a failure.** `npm run check | grep … && git commit` committed two commits (`54096fd`, `f5196e1`) while the check showed 10 failing tests: a pipe's exit status is the last command's, here `grep`'s. The failures were only 5-second timeouts while three sessions loaded the machine (load average about 27). A re-run with the exit code captured passed (exit 0, 1247 tests), so the commits were fine. From then on: `npm run check > log; echo $?`.
- **Writing a privacy notice from memory.** Read what each table stores and when it's deleted, in the code, before writing a word.
- **Putting samples in messages.** Messages ship with every build; samples live in `src/content/` and are read only through selectors.
- **A page export Next.js doesn't allow.** A page file may export only what Next.js knows (`default`, `generateMetadata`, `ensureStatic` …), so the privacy page's item list stayed private.

## Reviews

- **SEO check** (`seo-reviewer`, run by hand: this chat's automatic hook watches Session 1's folder): all 7 pages checked pass (the five new ones, `/login` and `/` for the changed links). Missing canonical URLs, sitemap, Open Graph and structured data wait for task 42. Its suggestions weren't applied (the owner decides): name Kiwale, Pune and the vehicles in the contact and FAQ headings, add an in-text link to `/faq`, and avoid a doubled brand in titles once task 42 adds a title template (noted for task 42).
- **`ce-code-review`** (six reviewers: correctness, adversarial, project standards, testing, maintainability, past lessons; nothing sent to another AI company, `cross_model_review_mode: off`). Verdict: ready with fixes, nothing at the top two levels. This session merged and checked the six reports itself, instead of handing that to separate helper agents as the skill describes. It checked the two privacy claims against Better Auth 1.7.14's own code. Fixed:
  - **The privacy notice was wrong in three places.**
    - Codes: an expired code isn't deleted at once. It goes the next time anyone types a code on the website, and a new code doesn't delete the old one.
    - Sessions: a login that runs out stays stored. Nothing deletes it yet.
    - Attempts: the notice said we keep data "only when you log in", but asking for a code already stores it.
    The reworded notice moved the fingerprint, and the version stays `2026-10-29` because the earlier wording never shipped.
  - **The fingerprint skipped the numbers.** The notice's hours, minutes and days come from `LOGIN_RULES`, so changing a rule changed the notice without failing the test. Now they're hashed with the wording (`PRIVACY_NOTICE_VALUES`), and a test changes one to prove the check fails.
  - **The coverage test missed new columns.** It now lists every personal table's columns, so a new column fails it too. Checked by adding a column on purpose.
  - **Untested paths.** Real (owner-given) about topics and FAQ answers: a test each, with no Sample mark. The browser test for `/terms` now looks for the terms page's own draft line, not the privacy page's.
  - **Code shape.**
    - The call and WhatsApp links were written three times: now `contact-rich-text.tsx`.
    - The FAQ's answer maps are typed by their real keys.
    - The footer list is `liveNavItems(footerItems)` instead of a copy of the same logic, and `footerOnlyItems` names it plainly.
    - A test keeps `LOGIN_NOTICE_VERSION` a date, because `/privacy` shows it as one.
  - **Not changed.** `home.ts` still re-exports the `Shown` type, so the home page's files didn't need edits. Two test files share a small tone helper by copy. Neither causes a bug.
- **Commit notes** the reviews found, left as they are (fixing them would rewrite history):
  - `8fac218` has a one-sentence body.
  - `9a38c93` and `6ae4ac9` are `feat` commits that also update tests, because flipping a page's `live` flag broke them.
  - `ad85d5f` is typed `feat`, but nothing in it is visible to a visitor (`refactor` would fit).
- Not run yet: `code-reviewer` and the compound step. Their results go here when they happen.

## Try it yourself

Pretend the owner confirmed the warranty: "6 months on all work". Move that answer from the samples into a real `faqItems` list in `src/content/faq.ts` and run `npx vitest run "src/app/[locale]/(site)/faq"`. Which test changes, and does the Sample badge disappear for that answer only?

## Learn more

- [next-intl: rich text](https://next-intl.dev/docs/usage/messages#rich-text): tags inside messages.
- [Next.js: generateMetadata and robots](https://nextjs.org/docs/app/api-reference/functions/generate-metadata#robots).
- [Digital Personal Data Protection Rules, 2025 (gazette PDF)](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf): the Rules this notice follows (Rule 3: what a notice says; Rule 14: rights and grievances).
- [Digital Personal Data Protection Act, 2023](https://prsindia.org/files/bills_acts/acts_parliament/2023/Digital_Personal_Data_Protection_Act,_2023.pdf): the Act itself (s.5 notice, ss.11–14 rights).
