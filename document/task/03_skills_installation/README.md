# 03_skills_installation: Install the Claude skills for UI work

> **Branch:** `03_skills_installation` · **Date:** 2026-10-24 · **Status:** Done

## In one minute

We installed 16 Claude Code skills from five official sources: GSAP (animation), shadcn/ui (components), Anthropic's frontend-design (visual direction), UI/UX Pro Max (design data and UX rules) and 21st.dev (ready-made components). They live in `.claude/skills/`, are committed to git, and are explained in [document/skills/skills.md](../../skills/skills.md).

## Why: the problem we solved

Claude knows a lot in general, but it doesn't automatically know the newest rules of a specific library or a specific taste. Two examples:

- shadcn/ui changed its form API (`FieldGroup` + `Field`). Without the skill, Claude might write the older pattern.
- Left alone, generated UI tends to look generic. The frontend-design skill exists to stop that.

A skill is a written expert guide Claude reads right when it's needed. Installing them **in the project** (not only on one laptop) means every teammate's Claude follows the same guides.

## What: what changed

| File or folder | Change | Why it exists |
| --- | --- | --- |
| `.claude/skills/gsap-*` (8 folders) | Added | Official GSAP animation guides |
| `.claude/skills/shadcn/` | Added | Official shadcn/ui guide and rules |
| `.claude/skills/frontend-design/` | Added | Anthropic's design-direction guide |
| `.claude/skills/ui-ux-pro-max/` | Added | Design database (CSV), search script (Python) and UX rules |
| `.claude/skills/21st-*` (5 folders) | Added | 21st.dev component search, build, explore, review, AI drafts |
| `skills-lock.json` | Added | Records each skill's source and content hash |
| `document/skills/skills.md` | Added | What each skill does and when to use it |
| `CLAUDE.md` | Changed | New "Skills" section: order of use and rules |
| `readme.md` | Changed | Repo map rows and prerequisites (Python 3, Claude Code, 21st account) |
| `document/task/task.md` | Changed | Task 03 marked done |

## How: step by step

1. **Find the official source of each skill.** We searched the [skills.sh](https://skills.sh) registry:
   ```bash
   npx skills find gsap
   npx skills find shadcn
   ```
   We picked skills published by the tool's own makers (`greensock`, `shadcn-ui`, `anthropics`, `21st-dev`) or the original author (`nextlevelbuilder`), with high install counts. Copies re-uploaded by other people were skipped.

2. **Read the files before installing.** A skill is instructions Claude will follow, with the same permissions Claude has. That makes installing one similar to running someone else's script. We downloaded each repo to a temporary folder and checked:
   - every `SKILL.md` (what it tells Claude to do),
   - the scripts: the UI/UX Pro Max Python files only read local CSV files, with no network calls; the shadcn `.mjs` helper only reads files,
   - a search for risky patterns (`curl`, `rm -rf`, "ignore previous instructions", reading `~/.ssh`). Nothing worrying turned up.

3. **Install into the project, one source per commit.**
   ```bash
   npx skills add greensock/gsap-skills --agent claude-code --skill '*' --copy -y
   npx skills add shadcn-ui/ui --agent claude-code --skill shadcn --copy -y
   npx skills add anthropics/skills --agent claude-code --skill frontend-design --copy -y
   npx skills add nextlevelbuilder/ui-ux-pro-max-skill --agent claude-code --skill ui-ux-pro-max --copy -y
   npx skills add 21st-dev/skill --agent claude-code --skill 21st-cli-use 21st-ai 21st-ui-build 21st-ui-explore 21st-ui-review --copy -y
   ```
   What the flags mean:
   - no `-g`: install in **this project** (`.claude/skills/`), not globally for your user,
   - `--agent claude-code`: only set it up for Claude Code (the tool supports 70+ agents),
   - `--skill ...`: install only the named skills from that repo (`'*'` = all of them),
   - `--copy`: copy real files instead of creating symlinks, so git stores the actual content,
   - `-y`: don't ask for confirmation.

   We committed after each source (`chore(skills): add ...`). If one skill ever causes trouble, its commit can be reverted alone.

4. **Check that what got installed is what we reviewed.**
   ```bash
   diff -rq <reviewed-copy>/skills/gsap-core .claude/skills/gsap-core   # no output = identical
   ```
   We ran this for all 16 skills; every one matched.

5. **Test the one skill that runs code.**
   ```bash
   python3 .claude/skills/ui-ux-pro-max/scripts/search.py "car repair booking service" --design-system -p "Go Mechanic"
   ```
   It printed a suggested design system for a car-repair booking product: a page pattern ("Trust & Authority + Conversion"), colors, fonts and a pre-delivery checklist.

6. **Write the docs**: `document/skills/skills.md`, a Skills section in `CLAUDE.md`, and readme updates. Then merge with `--no-ff`.

## Decisions worth knowing

- **Two 21st.dev skills were left out on purpose.** `21st-registry` and `21st-design-sync` publish code and themes to the public 21st.dev site. We don't need that, and a publish can't be taken back.
- **All 8 GSAP skills went in**, including `gsap-frameworks` (Vue and Svelte) which we probably won't use. Skills cost almost nothing until they're used, because Claude only loads a skill's full text when it's relevant.
- **The UI/UX Pro Max script path needed a note.** Its `SKILL.md` writes the path as `${CLAUDE_PLUGIN_ROOT}/.claude/skills/...`. That variable only exists when the skill is installed as a *plugin*. Since we installed it as a project skill, `CLAUDE.md` tells Claude to use `python3 .claude/skills/ui-ux-pro-max/scripts/search.py` from the repo root. We didn't edit the skill file itself, because `npx skills update` would overwrite the edit.
- **We didn't set up the 21st.dev login or MCP server.** Both need a personal account or API key. That's a step for you (see "Try it yourself").

## New ideas in this task

- **Skill:** a folder with a `SKILL.md` (a name, a description, then instructions). Claude sees every skill's description at the start of a session and loads the full text only when a request matches it.
- **Project skill vs user skill:** project skills live in `.claude/skills/` inside the repo and are shared through git. User skills live in `~/.claude/skills/` and only exist on your machine.
- **Lock file (`skills-lock.json`):** records exactly what was installed (source and a content hash) so the same set can be re-installed later. `package-lock.json` does the same job for npm packages.
- **Hash:** a short fingerprint calculated from a file's content. If one character changes, the hash changes, which makes unnoticed changes easy to catch.
- **`npx`:** runs a command from an npm package without installing it globally. `npx skills ...` downloads the `skills` tool, runs it, and leaves your system unchanged.
- **MCP server:** a small program that gives Claude extra tools (for example, a live connection to 21st.dev). Skills are instructions; MCP servers are tools. They often work together.

## Check that it works

```bash
npx skills list            # should list 16 project skills, all "Agents: Claude Code"
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "booking form" --domain ux
```

In Claude Code, type `/` and look for `frontend-design`, `ui-ux-pro-max` and the `gsap-*` skills in the menu. (`shadcn` won't appear there: it's set to load only automatically.)

## Common mistakes

- **Installing skills without reading them.** Skills run with Claude's permissions. Read them first, especially any scripts.
- **Installing globally by accident.** `-g` puts skills in `~/.claude/skills/`, where teammates never get them. For a shared project, leave out `-g`.
- **Symlinks in git.** Without `--copy`, the tool may create symlinks that point to a folder outside the repo. On a teammate's machine those links point at nothing.
- **Committing an API key.** The 21st.dev key goes in `~/.config/21st/auth.json` (via `login`) or an environment variable, never in a repo file.
- **Editing installed skill files.** The next `npx skills update` overwrites your edit without warning. Put project rules in `CLAUDE.md` instead.

## Try it yourself

1. **Connect 21st.dev** (about 5 minutes): run `npx @21st-dev/cli login`, then `npx @21st-dev/cli search "hero section" --limit 5`. Then try `npx @21st-dev/cli whoami` and `npx @21st-dev/cli usage` to see your account and limits.
2. **Explore the design data:** run the search script with `--domain typography` and a mood like `"friendly trustworthy"`. Pick a font pair you like.
3. **Read one skill end to end:** open `.claude/skills/gsap-react/SKILL.md`. Can you explain why `useGSAP()` is safer than `useEffect()` for animations?

## Learn more

- [Claude Code skills docs](https://code.claude.com/docs/en/skills): how skills are found, loaded and written.
- [skills.sh](https://skills.sh): the skills registry and leaderboard.
- [GSAP docs](https://gsap.com/docs/v3/) and the [useGSAP hook](https://gsap.com/resources/React/).
- [shadcn/ui docs](https://ui.shadcn.com/docs).
- [21st.dev](https://21st.dev): browse the component library.
