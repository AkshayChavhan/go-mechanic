# 08_seo_reviewer: An SEO check after every page change

> **Branch:** `08_seo_reviewer` · **Date:** 2026-10-24 · **Status:** In progress (review pending)

## In one minute

The owner asked for "an agent who checks every page is SEO friendly or not, if not suggests changes; run it every time after Claude makes changes and share the changes and suggestions". We built two pieces. The first is a read-only **`seo-reviewer` agent** with an SEO checklist. The second is a **Stop hook**: it notices when page files changed and makes Claude run that agent and post an "SEO check" before finishing its reply. There are no pages yet (task 09 creates the app), so for now the hook stays quiet. From the first page on, every page gets reviewed.

## Why: the problem we solved

SEO (search engine optimisation) means making pages easy for Google to find, understand and show. SEO mistakes are invisible in a browser. The page looks fine, but it has no title, or two `<h1>` headings, or its hero text only appears after a GSAP animation, or an `/admin` page is open to search engines. The owner is learning and wouldn't spot these. A manual check only works if someone remembers to do it.

Tasks 09–42 will build dozens of pages. Without this task, mistakes would pile up quietly and get found late (in task 42, the SEO task) or never. Setting the check up now means every page is reviewed from its first version, and each report teaches a bit of SEO.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `.claude/agents/seo-reviewer.md` | Added | The reviewer: what to check, how to report. Read-only. |
| `.claude/hooks/seo_check.py` | Added | The Stop hook script: fingerprints page files and asks for a review when they change |
| `.claude/settings.json` | Changed | Registers the script as a Stop hook. The plugin settings are kept as they were. |
| `.gitignore` | Changed | Ignores `.claude/.seo-reviewed.json`, the hook's personal memory of what it last reviewed |
| `CLAUDE.md` | Changed | New "SEO review" section, a `seo-reviewer` row in the Agents table, repo-map rows |
| `readme.md` | Changed | Repo-map rows. Python 3 is now also needed for the SEO check. |
| `document/plans/2026-10-24-2339-chore-seo-reviewer-hook-plan.md` | Added | The task's plan, written by `ce-plan` |
| `document/task/task.md` | Changed | Task 08 set to In progress, done steps ticked, plan linked |

## How it fits together

One turn that changes a page:

```
You ask for a page change
  → Claude edits src/app/..., writes its reply, and tries to stop
  → Stop hook runs seo_check.py
       nothing changed → prints nothing, Claude stops
       files changed   → prints {"decision": "block", "reason": "...run seo-reviewer..."}
  → Claude keeps going: runs seo-reviewer, then posts an "SEO check" section
  → Claude tries to stop again → stop_hook_active is true → the hook stays quiet → done
```

The plan has the same flow as two diagrams (a flowchart and a sequence diagram), under "High-Level Technical Design".

## How: step by step

1. **Branch from `main`.**
   ```bash
   git switch main
   git switch -c 08_seo_reviewer
   ```

2. **Plan with `ce-plan`.** Compound Engineering's `ce-plan` wrote the plan in one go (a one-shot session with no back-and-forth): [the plan](../plans/2026-10-24-2339-chore-seo-reviewer-hook-plan.md). It has requirements (R1–R10), key decisions, test scenarios and a table of checks. Then `ce-plan`'s review step had **four reviewer agents** read the draft. They proposed four improvements, and all four went into the plan before it was committed:
   - **Watch `src/content/` too.** Task 12 puts the garage's name, address and phone there, and the local-SEO check compares pages against them.
   - **Skip `.DS_Store`.** macOS Finder drops this file into folders like `public/`. On its own, it would have triggered a review.
   - **A "Waiting for task 42" line.** Task 42 builds titles, the sitemap and JSON-LD. Until then, these missing items go on one line and don't fail the page.
   - **Run `seo-reviewer` in the foreground.** If it ran in the background, it could review half-built pages while another agent was still writing them.

   This is the plan step doing its job. Each of the four would have been a bug found later. One would have caused a review every time you opened a folder in Finder. Another would have made every early report say "must fix" for work that's already planned. Fixing a sentence in a plan is cheaper than fixing code.

3. **Write the agent** (`.claude/agents/seo-reviewer.md`). The frontmatter (the settings block at the top) sets `tools: Read, Glob, Grep, Bash` and `model: inherit` (use the same model as the main session). The agent needs Bash to build the site and fetch the real HTML with `curl`. The prompt has three parts:
   - **Find:** which pages the changed files affect.
   - **Check:** six areas. They are metadata, structure, JSON-LD, crawling, Core Web Vitals and local SEO for India.
   - **Report:** a verdict per page. Each finding gets a **What** (with `file:line`), a **Why it matters** and a **Fix**, and is labelled "must fix" or "nice to have".

4. **Write the hook script** (`.claude/hooks/seo_check.py`). It uses only Python's standard library, so there's nothing to install. What it does, in order:
   - **Lines 77–84: check the two switches.** It does nothing when `GOMECHANIC_SEO_HOOK=off` is set or when `stop_hook_active` is true.
   - **Lines 86–96: compare fingerprints.** It hashes every watched file and compares the hashes with the state file. If nothing changed, it exits quietly.
   - **Lines 98–100: save first.** It saves the new hashes *before* asking for the review (see "Decisions worth knowing").
   - **Line 113: ask for the review.** It prints the block decision. The `reason` text is the instruction Claude follows.

5. **Test it in a scratch folder before switching it on.** Pointing the script at an empty temporary folder means testing never writes a state file into the real repo. Real output when this doc was written (run from the repo root):
   ```bash
   T=$(mktemp -d)
   mkdir -p "$T/src/app"
   echo 'export default function Home() { return <h1>Car service in Pune</h1>; }' > "$T/src/app/page.tsx"
   echo '{}' | CLAUDE_PROJECT_DIR="$T" python3 .claude/hooks/seo_check.py
   ```
   - `mktemp -d` makes a new empty folder in your system's temp area and prints its path. We keep the path in `T`.
   - `echo '{}' |` pretends to be Claude Code. Claude Code sends the hook a JSON object on standard input (stdin), and `{}` is the simplest one.
   - `CLAUDE_PROJECT_DIR="$T"` sets an environment variable for this one command only. It tells the script that the "project" is the scratch folder.
   ```
   {"decision": "block", "reason": "SEO check: these page files changed since the last SEO review:\n- src/app/page.tsx (new)\n\nRun the seo-reviewer agent on the pages these files affect (it only reads). Then reply to the owner with a short \"SEO check\" section: what changed, each page's verdict (Pass / Needs work) and the suggested fixes. Don't apply the suggestions unless the owner asks."}
   ```
   Running the same command again prints nothing, because nothing changed since the saved fingerprints. The main session tested 13 scenarios this way, and all 13 passed:
   - **Silent:** no page folders at all; nothing changed; `stop_hook_active` is true (the state file is left alone); `GOMECHANIC_SEO_HOOK=off`; only API, test or `.DS_Store` files changed.
   - **Reported:** a new, changed or deleted page; `src/content/garage.ts`.
   - **Odd input:** empty stdin works. A corrupt state file means everything is reported. With 25 changed files, 20 are listed, then "...and 5 more".

   Most of them were run again while writing this doc, with the same results.

6. **Register the hook** in `.claude/settings.json`, next to the plugin settings:
   ```json
   "hooks": {
     "Stop": [
       {
         "hooks": [
           {
             "type": "command",
             "command": "python3 \"$CLAUDE_PROJECT_DIR/.claude/hooks/seo_check.py\"",
             "timeout": 30,
             "statusMessage": "Checking for page changes (SEO)"
           }
         ]
       }
     ]
   }
   ```
   - `"Stop"` is the event: run this when Claude finishes a reply.
   - `"type": "command"` means "run a shell command".
   - `$CLAUDE_PROJECT_DIR` is set by Claude Code to the project root, so the hook works from any folder. The path is in quotes in case it contains spaces.
   - `timeout` gives the hook 30 seconds at most.
   - `statusMessage` is the text you see while it runs.

7. **Document it.** We added a "SEO review" section to `CLAUDE.md`, which Claude reads at the start of every session, and updated the repo map in `readme.md`.

8. **Test end to end in a fresh session.** We started a new session with `claude -p --model sonnet`:
   - `-p` (print mode) runs one prompt without the chat screen, prints the answer and exits.
   - `--model sonnet` picks the model.

   We left out `GOMECHANIC_SEO_HOOK=off` on purpose, because this time the child session *was* meant to get the review. We asked it to create `src/app/seo-probe/page.tsx` with an `<h1>` and an `<img>` without `alt`. (The exact prompt wasn't saved.) The hook fired once, `seo-reviewer` ran, and the session ended with this, copied as it was:
   ```text
   Warning: no stdin data received in 3s, proceeding without it. If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.
   ## SEO check

   **What changed:** I added one new page, `src/app/seo-probe/page.tsx`, served at `/seo-probe`. It is a test probe for the hook.

   **`/seo-probe`: Needs work.** The `seo-reviewer` agent reviewed the source only. It couldn't build the site, because the repo has no `package.json` or root layout yet.

   Suggested fixes (I haven't applied any):
   1. **Must fix:** the `<img src='/hero.jpg' />` has no `alt` attribute. Add a descriptive one, for example `alt="Mechanic servicing a car at the GoMechanic garage in Pune"`. Use `alt=""` if the image is only decoration.
   2. **Nice to have:** use `next/image` with `width`, `height`, `sizes` and `priority` instead of a plain `<img>`. That avoids layout shift and gives automatic image resizing.
   3. **Nice to have:** `/hero.jpg` doesn't exist, because there is no `public/` folder. The image would return a 404.
   4. **Nice to have:** the page has only an `<h1>` and an image. A real page needs body text, internal links such as booking and contact, and mentions of both cars and two-wheelers.
   5. **Nice to have:** the probe would be public and indexable. Delete `src/app/seo-probe/` after the test and don't merge it to `main`.

   **Done well:** there is exactly one `<h1>` and it matches the topic. The content sits inside `<main>` as server-rendered text.

   **Waiting for task 42:** title and meta description, canonical URL, `metadataBase` and title template, Open Graph and Twitter tags, the sitemap entry, `robots.ts` and JSON-LD.
   ```
   The first line is a harmless warning from `claude -p` itself. It waited 3 seconds for piped input that never came. Notice what the report did right: it caught the missing `alt`, didn't fix anything, and put the missing title on the "Waiting for task 42" line instead of failing the page for it.

   Then we deleted the probe page **and** the state file together, and checked that the hook was silent again. If we had deleted only the page, the next turn would have reported `src/app/seo-probe/page.tsx (deleted)` and started another review.

9. **Write this learning doc.** Every output block above was really run and copied, following [run-commands-before-documenting-output](../solutions/conventions/run-commands-before-documenting-output.md).

10. **Review.** (filled in after it happens)

11. **Compound.** (filled in after it happens)

## Decisions worth knowing

| Choice | Why | What it costs |
| --- | --- | --- |
| A **Stop** hook, not a hook after every edit | One review per turn, however many files changed. It also sees changes made by scripts, subagents and `git`, which an after-each-edit hook would miss. | The review comes at the end of the turn, not right after each edit |
| Compare **file contents** (hashes), not timestamps | Saving a file without changing it doesn't trigger a review. A `git switch` that really changes pages does. | Every watched file is read at the end of every turn. That's fine for a small site. |
| **Save the hashes before** the review runs | A skipped or interrupted review can't make every later turn block | A skipped review isn't asked for again. Ask "check SEO" to get one on demand. |
| Read-only **by instruction**, with Bash kept | The agent needs Bash to build the site and `curl` pages. A tool list can't say "Bash, but read-only". | It relies on the agent following its prompt, the same as `code-reviewer` |
| **Suggest, don't fix** | The owner chooses. Page changes stay small and reviewable, and each report is a lesson. | Making a fix takes one more request |
| An **environment switch** for child sessions | The hook's input has no reliable way to tell that it's running in a child `claude -p` session | You have to remember to type it |
| **No committed test file** | The repo has no Python test setup yet, so the scenarios were run by hand | A future change to the script won't be re-tested automatically |

## New ideas in this task

- **Hook:** a command Claude Code runs by itself at a fixed moment, such as before a tool runs or when Claude finishes. Think of a smoke alarm: nobody presses it, it reacts to what happens.
- **Stop event:** the moment Claude finishes its reply and is about to hand control back to you. A Stop hook can answer `{"decision": "block", "reason": "..."}`. Claude then keeps working and treats the `reason` as its next instruction. When a *subagent* finishes, Claude Code fires a different event, `SubagentStop`, so the reviewer finishing doesn't set our hook off again.
- **`stop_hook_active`:** a true/false field in the hook's input. It's `true` when Claude is already continuing because a Stop hook blocked. Our script then stays quiet, so it blocks **at most once per turn**. Without this check, a hook that always finds something wrong would keep sending Claude back to work, over and over. (Claude Code has a safety cap of 8 continuations in a row, but that's 8 wasted rounds.) It's like a teacher who says "check your work" once, not every time you hand it back in.
- **Fingerprint / hash (SHA-256):** a fixed-length code computed from a file's bytes. The same content always gives the same code. Change one character and you get a completely different code. Like a real fingerprint, it's small but identifies the whole thing. In the scratch test, the state file and `shasum -a 256` agreed:
  ```
  {
    "src/app/page.tsx": "90797c75031256257dc3ac9a3c9f9088b2155d86d9113df00d931dc4ef052961"
  }
  90797c75031256257dc3ac9a3c9f9088b2155d86d9113df00d931dc4ef052961  /var/folders/t0/8j37ljc50rb3d98r3v19t74h0000gn/T/tmp.w0eKNZpXBw/src/app/page.tsx
  ```
- **Environment variable switch:** an environment variable is a named setting that a program reads from its surroundings. Writing it in front of a command, as in `GOMECHANIC_SEO_HOOK=off claude -p ...`, sets it for that one command only. It works like a "do not disturb" sign on a single door.
- **Subagent (read-only by instruction):** a helper Claude defined in `.claude/agents/`, with its own prompt and tool list. The main session hands it a job and gets back a report. "Read-only by instruction" means nothing *technically* stops it from changing files through Bash; its prompt forbids it. Think of a building inspector who is told to report problems, not repair them.
- **Canonical URL:** the one official address of a page, set with `<link rel="canonical">` (in Next.js, `alternates.canonical`). When the same content is reachable at several URLs (for example with `?utm_source=...` tracking added), it tells Google which one to show.
- **JSON-LD:** facts about the page written as JSON inside `<script type="application/ld+json">`, for machines rather than people. For example, `AutoRepair` with the garage's address, phone and opening hours. It's like a business card stapled to the page, and it helps Google show richer results.
- **Core Web Vitals:** Google's three measures of how a page feels to use. **LCP** (Largest Contentful Paint) measures how fast the main content shows. **INP** (Interaction to Next Paint) measures how fast the page reacts to a tap. **CLS** (Cumulative Layout Shift) measures how much the layout jumps while loading.
- **noindex:** a tag, `<meta name="robots" content="noindex">`, that asks search engines to keep a page out of their results. It's for pages like `/admin`, `/account` and `/login`. Google's docs add a catch: the crawler has to be able to read the page to see the tag, so a `noindex` page must not also be blocked in `robots.txt`.

## Check that it works

Real output when this doc was written, run from the repo root:

```bash
python3 -m json.tool .claude/settings.json > /dev/null && echo "settings OK"
git check-ignore .claude/.seo-reviewed.json
```
```
settings OK
.claude/.seo-reviewed.json
```

- `python3 -m json.tool` parses the file and fails loudly if the JSON is broken. The plugin and the hook both live in this file, so it must stay valid.
- `git check-ignore` prints the path when the file **is** ignored, so the state file can't be committed by accident.

For the hook itself, repeat step 5 in a scratch folder. Then try the two switches. Both of these printed nothing, and a plain run afterwards still reported `src/app/page.tsx (changed)`:

```bash
echo '// edit' >> "$T/src/app/page.tsx"
echo '{"stop_hook_active": true}' | CLAUDE_PROJECT_DIR="$T" python3 .claude/hooks/seo_check.py
echo '{}' | GOMECHANIC_SEO_HOOK=off CLAUDE_PROJECT_DIR="$T" python3 .claude/hooks/seo_check.py
```

## Common mistakes

- **Running `claude -p` without `GOMECHANIC_SEO_HOOK=off`.** The child session gets the review instead and saves the fingerprints. Your own session then sees "nothing changed", and you never see the SEO check. Always write `GOMECHANIC_SEO_HOOK=off claude -p ...`. If it already happened, ask Claude to "check SEO".
- **Assuming when a new hook or agent starts working.** The plan assumed that hooks and agents load only when a session starts, so it ran the end-to-end test in a new session. The current Claude Code docs say edits to hooks in settings files and to agent files are normally picked up mid-session by a file watcher. There are exceptions, such as an `agents` folder created after the session started. We didn't test the same-session case. (In this repo the hook stays silent anyway, because there are no page folders yet.) The safe habit is to test in a fresh session, as we did, and check `/hooks` to see what's registered.
- **Committing the state file.** `.claude/.seo-reviewed.json` records what *your* machine last reviewed, so it means nothing to anyone else. It's git-ignored. Never force it in with `git add -f`.
- **Testing the script inside the repo.** Without `CLAUDE_PROJECT_DIR`, the script uses the current folder. Run in the repo, it writes a real state file, and later page changes might look "already reviewed". Use a scratch folder.
- **Applying SEO suggestions without the owner asking.** The hook's message says not to. Fixes are the owner's choice, and slipping them into an unrelated task makes that task bigger and harder to review.

## Try it yourself

About 10 minutes, all in a scratch folder (`T=$(mktemp -d)`, as in step 5). For each step, predict the result first, then run the hook.

1. Create `$T/src/app/page.tsx` and run the hook. Then `touch "$T/src/app/page.tsx"` (which updates its timestamp only) and run it again. Is the second run silent? Why?
2. Add these one at a time, running the hook after each: `$T/public/.DS_Store`, then `$T/public/logo.svg`, then `$T/src/app/api/book/route.ts`. Which ones get reported?
3. Look at lines 98–100 of `.claude/hooks/seo_check.py`. What would go wrong if the script saved the fingerprints only *after* a successful review? (Hint: can the hook tell whether the review really ran?)
4. In the end-to-end report in step 8, why is the missing `<title>` not listed as a "must fix"?

Answers from a real run: (1) silent, because the content didn't change; (2) only `public/logo.svg (new)` is reported.

## Learn more

- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks): the Stop event, `stop_hook_active` and the `decision`/`reason` output.
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents): how `.claude/agents/` files work.
- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide): the basics, from Google itself.
- [Google: canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) and [noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
- [Google: intro to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data): what JSON-LD is for.
- [web.dev: Web Vitals](https://web.dev/articles/vitals): LCP, INP and CLS explained.
- [Next.js: metadata](https://nextjs.org/docs/app/getting-started/metadata-and-og-images) and [JSON-LD](https://nextjs.org/docs/app/guides/json-ld): how task 42 will add titles and structured data.
