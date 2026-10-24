# 07_website_plan: Save the approved website plan in the repo

> **Branch:** `07_website_plan` · **Date:** 2026-10-24 · **Status:** In progress (merge pending)

## In one minute

We agreed with the owner on what to build: a website and booking system for **one garage, GoMechanic**, for cars and two-wheelers, English first, Apple-like design, no online payments yet. The plan existed only in Claude's private plan file. This task copied it into the repo: a feature list, the full master plan, and 40 tasks (07–46) in the tracker. Now anyone, human or Claude, can find it.

## Why: the problem we solved

A plan that lives in one chat session is lost when the session ends. Saving it in the repo means:

- **Every future session reads it.** `CLAUDE.md` points to it, so Claude knows the stack, the design and what comes next.
- **Changes are tracked.** If the plan changes, git shows what changed and when.
- **Work can be split.** Each of the 40 tasks has a number, a branch name and starting steps, so the work goes in small, reviewable pieces.

## How we got to the plan

This is the part worth learning: planning took several rounds, and each round changed the plan.

1. **Ask before assuming.** Claude asked four questions: who it's for, which vehicles, which languages, how much in version 1. The answers changed everything. "Full platform except payments" is very different from "a brochure site".
2. **Be ready to throw work away.** One answer pointed to a *multi-garage platform*, and a design agent started on that. Then the owner clarified: *one garage only*. Claude stopped the agent and started again. Building the wrong thing would have cost far more.
3. **Clear up small ambiguities.** "Make it like `/gomechanic`" could mean two things. One question settled it: the site lives at the **domain root**.
4. **Flag costs early.** OTP, SMS and WhatsApp cost money and Indian SMS needs DLT registration, which takes days to weeks. The owner chose free stand-ins first, with real providers connected in tasks 44–45 (task 46 is the production launch).
5. **Let a specialist go deep.** A planning agent read the Next.js 16 docs bundled in `node_modules/next/dist/docs/` and designed the data model, the services and the task order. Claude merged its result into the plan.
6. **Reorder when the goal changes, and name the cost.** After approval, the owner asked for an Apple-like UI with good animation. So tasks 12–16 were reordered to build the **layout and home page before the database and login**, and the look can be seen and refined early. The price: the layout and home page show things whose real data doesn't exist yet (opening hours, services, reviews, offers). Tasks 12–13 use **labelled placeholder content** from typed files in `src/content/`. Later tasks each have a step to switch one piece to real data: garage details and hours in 14, services in 18, reviews in 37, offers in 38. Sample reviews are marked as samples, so made-up reviews never go live as if they were real.

## What: what changed

| File | Change | Why it exists |
| --- | --- | --- |
| `document/website/features.md` | Added | What the site does: 36 features, roles, pages, design direction |
| `document/plans/2026-10-24-gomechanic-master-plan.md` | Added | The approved plan: architecture, data model, services, risks, all tasks, how to verify |
| `document/task/task.md` | Changed | Tasks 07–46 with starting steps; old backlog replaced; "Backlog (later)" list |
| `CLAUDE.md` | Changed | The project, stack and design are now decided, with links to the plan |
| `readme.md` | Changed | Describes GoMechanic and links the plan |

The tracker's steps for tasks 14–46 are a starting point. Each task's detailed plan is written by `ce-plan` when that task begins, so it reflects what we've learned by then. (This task's own plan is the master plan, made with the owner in Claude's plan mode rather than with `ce-plan`.)

## How: the commands

```bash
git switch main                  # start from the latest main
git switch -c 07_website_plan    # create this task's branch
# ...write the files...
git add document/website/features.md document/plans
git commit -m "docs: add GoMechanic feature list and approved master plan"
git add document/task/task.md
git commit -m "docs: add tasks 07-46 to the tracker, replace old backlog"
git add CLAUDE.md readme.md
git commit -m "docs: record decided project, stack and design in CLAUDE.md and readme"
```

Each kind of change (product docs, tracker, rules) got its own commit, so each can be reviewed or reverted alone. Files are added by path rather than with `git add .`, so nothing unexpected slips in.

## Review

The `code-reviewer` agent said **Needs changes**. What it caught:

- **must fix:** the risk list still said "Better Auth in 13". After the reorder, Better Auth is task 15.
- **must fix:** the reorder put the layout and home page before the data they show, and the plan didn't say how that works. Also, "garage details move to the database in task 40" clashed with task 14, which already stores them. Now tasks 12–13 use labelled placeholders, task 14 moves garage details and hours, and tasks 18, 37 and 38 each have a step to switch their part of the home page to real data.
- **must fix:** this doc claimed the reorder cost nothing. Step 6 now names the cost.
- **Suggestions we took:**
  - add a "start the DLT and Meta paperwork" step to task 21, because sessions work from `task.md`, not the plan;
  - link the master plan from the tracker;
  - show the real commands (above);
  - update how `readme.md` and `CLAUDE.md` describe `document/plans/`;
  - restore "(owner only)" for team and roles in `features.md`;
  - move the design preview to `/dev/design` so search engines skip it;
  - fix the table count and the "44–46" range.
- **Noticed:** the branch appeared on GitHub 15 seconds after the last commit. Claude didn't run `git push`; it was pushed from outside this session.

**Compound:** the lesson "when you reorder tasks, check what each moved task needs from the tasks it now runs before" is real. But it's now built into the plan as concrete steps, and it's specific to this reorder. So no separate solution doc.

## New ideas in this task

- **Requirements:** what the software must do, written down before building. Ours are in `features.md`.
- **Milestone:** a group of tasks that together deliver something visible ("public site", "booking", "launch").
- **Dependency:** a task that needs another one finished first. The booking flow needs time slots, which need the database.
- **Stand-in (fake) provider:** a pretend version of a paid service. The fake SMS sender writes the OTP to a dev page instead of a phone, so you can build and test for free.
- **Scope:** what's in version 1 (bookings, tracking, estimates) and what isn't (payments, GST invoices). Writing both down stops a project from growing forever.

## Check that it works

```bash
ls document/website document/plans
grep -c "^### " document/task/task.md
```

`grep -c` counts matching lines instead of printing them. `^### ` means "a line that **starts** with `### `" (`^` = start of line), which is how every task's steps section begins.

Real output when this doc was written:

```
document/plans:
2026-10-24-gomechanic-master-plan.md

document/website:
features.md
46
```

46 sections: tasks 01–06 plus the 40 new tasks, 07–46.

## Common mistakes

- **Building straight from the first answer.** The "many garages" reading would have produced the wrong product. Ask, confirm, then build.
- **Keeping a plan where only one session can see it.** Save it in the repo.
- **Planning every detail of task 46 now.** Detailed plans go stale. Plan the next task in detail, and keep later ones as one-line goals.
- **Forgetting the owner's decisions.** "No payments in v1" and "fakes until launch" are written in the plan, so nobody adds them by accident.

## Try it yourself

1. Open the master plan and find the **data model** section. Which table stores the line items the customer approves or rejects?
2. In the **master plan's task table**, find a task that needs an **owner decision** (last column). What decision is it, and why can't Claude decide it alone?

## Learn more

- [Shape Up, chapter 4: "Find the elements"](https://basecamp.com/shapeup/1.3-chapter-04): turning a rough idea into a buildable plan.
