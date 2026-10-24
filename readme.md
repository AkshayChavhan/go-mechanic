# Go Mechanic

Go Mechanic is a web app project. Right now the repo holds the **project setup only**: docs, task tracking and the Claude Code tooling. App code starts in a later task (see the backlog in the [task tracker](document/task/task.md)).

## How we work

Every change is a small, numbered **task**:

1. The task is listed in [document/task/task.md](document/task/task.md).
2. It gets its own git branch with the same name, for example `01_project_setup`.
3. It ships with a learning doc, `document/task/<task>/README.md`, that explains **why** we made the change, **what** changed and **how** we did it.

New here? Read the learning docs in order, starting with [01_project_setup](document/task/01_project_setup/README.md).

## Repo map

| Path | What it is |
| --- | --- |
| `readme.md` | This file. The front page of the repo. |
| `.gitignore` | Files git must never track: dependencies, build output, secrets. |
| `document/task/task.md` | The task tracker: every task, its branch, its status and its learning doc. |
| `document/task/TEMPLATE.md` | The starting point for each task's learning doc. |
| `document/task/NN_name/README.md` | One learning doc per task. |

## Prerequisites

- Git
- Node.js 20 or newer (check with `node -v`)
