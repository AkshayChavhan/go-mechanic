# 05_website_plan: Turn "a website for a mechanic" into a plan

> **Branch:** `05_website_plan` · **Date:** 2026-10-24 · **Status:** Done

## In one minute

The request was: *"create a website for a mechanic with all the features every mechanic wants."* That's too vague to build directly. This task turned it into a written plan in [document/website/features.md](../../website/features.md): who the site is for, the features, what's left out on purpose, the pages, the decisions we made, and eleven small tasks (06 to 16) that build it. No code yet.

## Why: the problem we solved

"All the features" means something different to everyone. If you start coding straight away:

- you build what's easy, not what customers need,
- you keep adding "one more thing" and never finish,
- nobody can review the work, because there's nothing to compare it against.

A short written plan fixes all three. It's also the cheapest place to change your mind: rewriting a bullet point takes seconds, rewriting a page of code takes hours.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `document/website/features.md` | Added | The product plan: users, features, out of scope, pages, decisions, tasks |
| `document/task/task.md` | Changed | Tasks 05 to 16 with steps; the old guessed backlog replaced by the real plan |
| `CLAUDE.md` | Changed | Describes the website and the chosen stack; points to the plan; example task names updated |
| `readme.md` | Changed | Describes the website and links the plan |
| `.gitignore` | Changed | Ignores `data/`, where bookings with customers' personal details will be saved |
| `task-planner.md`, `skills.md`, `01_project_setup/README.md`, `04_agents/README.md` | Changed | Example task names updated (`05_app_setup` became `06_app_setup`); note that the old backlog was replaced |

## How: step by step

1. **Start from the people, not the features.** We wrote down who visits the site and what they want to know:
   - **Car owners:** Can you fix it? How much? When? Can I trust you? How do I reach you right now?
   - **The garage:** more bookings, fewer phone calls, one place to manage jobs.

   Then every feature had to answer one of those questions. A feature that answers none of them doesn't go in.

2. **Group features by the job they do.** Five groups: *get found and trusted*, *understand services and prices*, *book and stay informed*, *reach the garage*, *run the garage*. Grouping makes gaps easy to spot. For example, the "book" group showed that customers would want to know their booking's status afterwards, which is where the **track a booking** feature came from.

3. **Write down what's out of scope, and why.** Payments, notifications, customer accounts and a real database are all useful, but each needs a paid service or a decision we can't make yet. Listing them in a backlog means they're not forgotten, and nobody is surprised they're missing.

4. **Write down the decisions and assumptions.** We didn't have the garage's real name, address or phone number, so we chose sensible defaults and said so:
   - **Stack:** Next.js + TypeScript + Tailwind + shadcn/ui + GSAP, because that's what the installed skills are built for.
   - **Sample business details** in one file, so swapping in the real ones is a single edit.
   - **Indian market** (₹, +91, WhatsApp), because the owner seems to be in India. Easy to change.
   - **Bookings in a JSON file** in `data/`, to learn the full flow without setting up a database. `data/` is added to `.gitignore` in this task, because it will hold customers' names, phone numbers and addresses.

   An assumption written down can be checked and corrected. A hidden one turns into a bug later.

   **To be clear:** these are Claude's defaults, not the owner's confirmed choices. The request was "build the whole site", with no stack or business details, so Claude picked and wrote them down, and `features.md` marks them as not yet confirmed. `CLAUDE.md` used to say "confirm the stack with the user before scaffolding"; the owner asking for the full build was taken as the go-ahead. The reviewer rightly flagged this.

5. **Split the work into tasks in build order.** Foundations first (app, design, layout), then pages that only show information, then forms that save data, then the admin side that reads the saved data, then the final polish. Each task is one branch.

6. **Commit.** Look before you stage: `git status` lists every changed file, so you can spot anything that shouldn't be committed (a `.env`, customer data). Then stage by path instead of `git add .`:
   ```bash
   git status
   git add document/ CLAUDE.md readme.md .claude/agents/task-planner.md
   git commit -m "docs: add website feature plan and tasks 06-16"
   ```

7. **Review.** The `code-reviewer` agent said **Needs changes**:
   - **must fix:** the plan said `data/` was git-ignored, but it wasn't. Booking data would have been committed. We added `data/` to `.gitignore`.
   - **must fix:** the offer banner had no task. We added a step to `08_layout_shell`.
   - The stack and market were stated as decided, without the owner confirming. We now mark them as Claude's defaults (see step 4).
   - Smaller fixes: `ADMIN_PASSWORD` now has an `.env.example` step in task 15; the WhatsApp claim is labeled as an assumption; the "How to add a task" example now uses a placeholder name instead of a real backlog item.
   - One big commit again. The fixes went into a separate commit, and from task 06 on, code, docs and tracker changes go in separate commits.

8. **Merge.** `git switch main && git merge --no-ff 05_website_plan`.

## New ideas in this task

- **Requirements:** a description of what the software must do, written before building it. Ours is `features.md`.
- **User need vs feature:** the need is "I want to know if my car is ready"; the feature is "a tracking page". Start from needs; features are one way to meet them.
- **Scope:** what's in this build. **Out of scope:** what's deliberately left out. Saying both stops a project from growing forever ("scope creep").
- **MVP (minimum viable product):** the smallest version that's useful to real people. Here: a garage could go live with tasks 06 to 16, and add the backlog later.
- **Assumption:** something we treat as true without confirming it. Write assumptions down so someone can challenge them.
- **Dependency order:** building things in the order they rely on each other. The tracking page needs saved bookings, so it comes after the booking form.

## Check that it works

A plan "works" if it answers these questions. Open `features.md` and check:

- Can you name the two kinds of users and what each wants? (Section "Who the site is for")
- Can you find every page and its address? (Section "Pages")
- Can you say what's *not* being built, and why? (Section "Not in this build")
- Can you point to the task that builds each feature? (Section "Task breakdown")

## Common mistakes

- **Listing features without users.** You end up with a page nobody needs.
- **No "out of scope" list.** Every conversation adds features, and the project never ships.
- **Hiding assumptions.** "We assumed India" is fine if it's written down. If it isn't, the first person to notice the ₹ sign thinks it's a bug.
- **Tasks that are too big**, like "build the website". If a task can't be reviewed in about 15 minutes, split it.
- **Treating the plan as frozen.** Plans change as you learn. When a task changes a feature, update `features.md` in that same task.

## Try it yourself

1. Think of a local business you use (a salon, a clinic, a bakery). Write its two kinds of users and three questions each one has.
2. For each question, write one feature that answers it.
3. Pick one feature you would leave out of a first version, and write one sentence on why.

## Learn more

- [Shape Up, chapter 4: "Find the elements"](https://basecamp.com/shapeup/1.3-chapter-04): a practical way to go from a rough idea to a buildable plan.
- [What is an MVP? (Atlassian)](https://www.atlassian.com/agile/product-management/minimum-viable-product): a short explainer.
