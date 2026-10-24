# Claude skills in this project

This page lists every Claude Code skill installed in this repo: what it does, when Claude uses it, and how the skills work together. For how we installed them, see the learning doc [03_skills_installation](../task/03_skills_installation/README.md).

## What is a skill?

A **skill** is a folder with a `SKILL.md` file in it: written instructions, sometimes with scripts and data, that teach Claude how to do one kind of job well. Think of it as a how-to guide Claude can take off the shelf when it needs it.

- At the start of a session Claude sees only each skill's **name and one-line description**. That's cheap.
- When your request matches a description ("animate this hero", "add a dialog"), Claude loads the full `SKILL.md` and follows it.
- You can also call a skill yourself by typing `/skill-name`, for example `/frontend-design`. (Exception: `shadcn` is set to load only automatically.)

Our skills live in `.claude/skills/`, so they are **project skills**: they're committed to git, and everyone who clones the repo gets the same ones.

## Installed skills at a glance

| Skill | From | Use it for |
| --- | --- | --- |
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) (Anthropic) | Choosing a distinctive look: palette, type, layout, copy |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Data-backed design system, UX rules, accessibility checklist |
| `shadcn` | [shadcn-ui/ui](https://github.com/shadcn-ui/ui) (shadcn) | Adding, composing and theming shadcn/ui components |
| `21st-cli-use` | [21st-dev/skill](https://github.com/21st-dev/skill) (21st.dev) | Searching and installing ready-made components from 21st.dev |
| `21st-ui-build` | 21st-dev/skill | Building a page or section using the project's design plus 21st references |
| `21st-ui-explore` | 21st-dev/skill | Comparing three different design directions before building |
| `21st-ui-review` | 21st-dev/skill | Auditing UI for accessibility, responsiveness and design drift |
| `21st-ai` | 21st-dev/skill | Generating UI drafts with 21st's hosted AI (paid, needs AI access) |
| `gsap-core` | [greensock/gsap-skills](https://github.com/greensock/gsap-skills) (GreenSock) | Basic tweens: `gsap.to()`, `from()`, easing, stagger, reduced motion |
| `gsap-react` | greensock/gsap-skills | GSAP in React and Next.js: `useGSAP`, refs, cleanup |
| `gsap-timeline` | greensock/gsap-skills | Sequencing several animations |
| `gsap-scrolltrigger` | greensock/gsap-skills | Scroll-linked animation, pinning, parallax |
| `gsap-plugins` | greensock/gsap-skills | Plugins: SplitText, Flip, Draggable, ScrollSmoother and more |
| `gsap-performance` | greensock/gsap-skills | Smooth 60 fps animation, avoiding jank |
| `gsap-utils` | greensock/gsap-skills | Helpers: `clamp`, `mapRange`, `snap`, `toArray` |
| `gsap-frameworks` | greensock/gsap-skills | GSAP in Vue and Svelte (installed with the pack; we use React) |

## The skills in detail

### frontend-design (Anthropic)

Makes Claude act like a design lead who avoids "AI-looking" templates. Before writing code it plans a small token system (4 to 6 named colors, typefaces, a layout idea, design principles), checks the plan against the brief, then builds and critiques its own work.

- **Why we want it:** without it, generated sites tend to look the same (identical rounded cards, gradient washes, an all-caps label above every heading).
- **Try:** *"Use frontend-design to propose a visual direction for the Go Mechanic home page."*

### ui-ux-pro-max (nextlevelbuilder)

A searchable database (CSV files plus a Python search script) of styles, color palettes, font pairings, UX guidelines, landing-page patterns, GSAP presets and stack-specific rules, with a priority list from accessibility (first) to charts (last).

- **Needs:** Python 3. The script uses only the standard library and makes no network calls.
- **Run the search script from the repo root.** Its `SKILL.md` writes the path as `${CLAUDE_PLUGIN_ROOT}/.claude/skills/...`, which only works when it is installed as a plugin. In this repo use:
  ```bash
  python3 .claude/skills/ui-ux-pro-max/scripts/search.py "car repair booking service" --design-system -p "Go Mechanic"
  python3 .claude/skills/ui-ux-pro-max/scripts/search.py "form error validation" --domain ux
  python3 .claude/skills/ui-ux-pro-max/scripts/search.py "suspense streaming" --stack nextjs
  ```
- **Saving a design system:** add `--persist --output-dir .` to write `design-system/go-mechanic/MASTER.md`. Don't add `--force` unless you mean to overwrite earlier decisions.
- **Try:** *"Use ui-ux-pro-max to check this form against its UX rules."*

### shadcn (shadcn/ui)

shadcn/ui isn't a package you import. Its CLI **copies component source code into your project**, so you own and can edit every component. The skill teaches Claude the CLI and the rules for using the components correctly.

- **Key rules it enforces:** use existing components before writing custom markup; use semantic colors (`bg-primary`, `text-muted-foreground`) instead of raw ones (`bg-blue-500`); use `gap-*` instead of `space-y-*`; forms use `FieldGroup` + `Field`; every `Dialog` needs a `DialogTitle`.
- **Works once the app exists.** Every time the skill loads it runs `npx shadcn@latest info --json` to read the project's `components.json`. Until task `05_app_setup` creates the app, that command has nothing to report.
- **Try:** *"Add a booking dialog with a date picker using shadcn."*

### 21st.dev skills

[21st.dev](https://21st.dev) is a community library of React + Tailwind + shadcn components. The skills drive its `21st` CLI (`npx @21st-dev/cli`).

- **Setup (once per machine):** `npx @21st-dev/cli login`, which opens the browser and saves a token in `~/.config/21st/auth.json`, outside the repo. Or create an API key at https://21st.dev/settings/api-keys and put it in the `TWENTYFIRST_TOKEN` environment variable. **Never commit the key.**
- **Cost:** searching and previews are free. Fetching component code has a free daily limit. `21st-ai` generation needs paid AI access; if it isn't enabled, the skills fall back to searching and adapting existing components.
- **Which one when:** `21st-ui-explore` when the direction is undecided, `21st-ui-build` to implement, `21st-ui-review` to audit, `21st-cli-use` to find or install one component.
- **Try:** *"Search 21st for a pricing section we could adapt."*

**Not installed on purpose:** `21st-registry` and `21st-design-sync`. Both **publish** code or themes to the public 21st.dev site. We don't need that, and publishing by accident can't be taken back. Add them later if the team decides to publish.

### GSAP skills (GreenSock)

Official skills for [GSAP](https://gsap.com), a JavaScript animation library. All GSAP plugins (SplitText, MorphSVG and others) are free, including for commercial use. No license key or private npm registry is needed.

- **For this project start with `gsap-react`.** It teaches the `useGSAP()` hook from `@gsap/react`, which cleans up animations automatically when a component unmounts. Plain `useEffect` makes it easy to leak animations.
- **Always respect reduced motion.** `gsap-core` covers `gsap.matchMedia()` with `prefers-reduced-motion`, for users who turn animations off in their system settings.
- **Try:** *"Add a GSAP entrance animation to the hero, with a reduced-motion fallback."*

## How the skills work together

Building a new page usually goes like this:

1. **Direction:** `frontend-design` sets the visual idea. `ui-ux-pro-max --design-system` supplies data (palettes, font pairs, page patterns) to choose from. If you're unsure, `21st-ui-explore` compares three directions.
2. **Components:** `shadcn` for the building blocks. `21st-cli-use` to check whether a ready-made section exists before building one by hand.
3. **Motion:** `gsap-react` plus `gsap-timeline` or `gsap-scrolltrigger`, used sparingly. One well-made moment beats an animation on every section.
4. **Review:** `21st-ui-review` and the ui-ux-pro-max pre-delivery checklist (contrast, keyboard focus, reduced motion, mobile widths).

**When skills disagree:** ui-ux-pro-max gives common, data-backed defaults; frontend-design pushes away from defaults toward a distinct identity. Treat ui-ux-pro-max output as **input and a safety checklist**, and let frontend-design and the product brief make the final visual call. Accessibility rules always win.

## Managing skills

Run these from the repo root. `skills-lock.json` records each skill's source and a hash of its content, so installs are repeatable.

```bash
npx skills list                       # what's installed in this project
npx skills update -p                  # update project skills to the latest version
npx skills add <owner/repo> --agent claude-code --skill <name> --copy -y   # add one
npx skills remove <name>              # remove one
npx skills experimental_install       # re-install everything listed in skills-lock.json
```

After any update, **read the diff before committing** (`git diff .claude/skills`). A skill is instructions Claude will follow, with the same permissions Claude has, so treat a skill update like a code change from someone else.

Find more skills at [skills.sh](https://skills.sh).
