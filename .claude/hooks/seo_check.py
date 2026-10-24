#!/usr/bin/env python3
"""Stop hook: ask Claude to run the seo-reviewer agent after page files change.

Claude Code runs this script every time Claude finishes a reply (the "Stop"
hook in .claude/settings.json). It takes a fingerprint (SHA-256 hash) of every
file that makes up the website's pages and compares them with the fingerprints
saved after the last SEO review.

- Something changed -> print a "block" decision. Claude Code then keeps Claude
  going with our instruction: run the seo-reviewer agent and share its report.
- Nothing changed  -> print nothing, so Claude stops normally.

It never loops: when Claude is already continuing because of this hook
(`stop_hook_active` is true), the script does nothing.

Turn it off for one session with the environment variable
GOMECHANIC_SEO_HOOK=off (useful for one-shot `claude -p` helper runs).
"""

import hashlib
import json
import os
import sys
from pathlib import Path

# Folders whose files affect what visitors and search engines see.
WATCHED_DIRS = ["src/app", "src/components", "src/content", "src/i18n", "messages", "public"]
# Inside those folders, skip things that don't change pages.
SKIPPED_PARTS = {"api", "__tests__", "node_modules"}
SKIPPED_SUFFIXES = (".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")
# Files that never affect a page (macOS Finder drops .DS_Store into folders).
SKIPPED_NAMES = {".DS_Store"}
# Where the fingerprints from the last review are kept (git-ignored).
STATE_FILE = ".claude/.seo-reviewed.json"
# How many changed files to list by name in the message.
MAX_LISTED = 20


def is_watched(relative: Path) -> bool:
    if any(part in SKIPPED_PARTS for part in relative.parts):
        return False
    if relative.name in SKIPPED_NAMES:
        return False
    return not relative.name.endswith(SKIPPED_SUFFIXES)


def fingerprints(root: Path) -> dict[str, str]:
    """Map each watched file (path relative to the repo) to its SHA-256 hash."""
    result: dict[str, str] = {}
    for folder in WATCHED_DIRS:
        base = root / folder
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file():
                continue
            relative = path.relative_to(root)
            if is_watched(relative):
                result[relative.as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def changed_files(before: dict[str, str], after: dict[str, str]) -> list[str]:
    """Files that were added, edited or deleted, with a short label."""
    changes = []
    for name in sorted(set(before) | set(after)):
        if name not in before:
            changes.append(f"{name} (new)")
        elif name not in after:
            changes.append(f"{name} (deleted)")
        elif before[name] != after[name]:
            changes.append(f"{name} (changed)")
    return changes


def main() -> int:
    if os.environ.get("GOMECHANIC_SEO_HOOK", "").lower() == "off":
        return 0
    try:
        hook_input = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        hook_input = {}
    if hook_input.get("stop_hook_active"):
        return 0  # We already asked once in this cycle: let Claude stop.

    root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or hook_input.get("cwd") or ".").resolve()
    state_path = root / STATE_FILE
    try:
        reviewed = json.loads(state_path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        reviewed = {}

    current = fingerprints(root)
    changes = changed_files(reviewed, current)
    if not changes:
        return 0

    # Save first, so the next Stop passes even if the review is skipped.
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(current, indent=2, sort_keys=True) + "\n")

    listed = "\n".join(f"- {c}" for c in changes[:MAX_LISTED])
    if len(changes) > MAX_LISTED:
        listed += f"\n- ...and {len(changes) - MAX_LISTED} more"
    reason = (
        "SEO check: these page files changed since the last SEO review:\n"
        f"{listed}\n\n"
        "Run the seo-reviewer agent on the pages these files affect (it only reads). "
        "Then reply to the owner with a short \"SEO check\" section: what changed, "
        "each page's verdict (Pass / Needs work) and the suggested fixes. "
        "Don't apply the suggestions unless the owner asks."
    )
    print(json.dumps({"decision": "block", "reason": reason}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
