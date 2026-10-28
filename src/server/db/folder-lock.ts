// A lock file, so only one process at a time opens a PGlite data folder.
//
// PGlite has one connection, and nothing in it stops a second process from
// opening the same folder: two writers corrupt it. `next dev` is not always
// one process. When a cached read is slow (over 10 s: a cold start, a busy
// machine), Next.js 16 runs it again in a helper process (its "use-cache
// probe", a jest-worker child of next-server) to check for a deadlock. In
// task 14 that helper opened .pglite/ while next-server had it open.
//
// The lock is a file next to the folder (.pglite.lock). It's created with the
// "wx" flag: the operating system creates the file only if it doesn't exist
// yet, so exactly one process wins. The file holds the winner's process id
// and a random token. A process that finds the file already there:
// - throws if that process is still running;
// - takes the lock over if it isn't (it crashed or was killed before it could
//   clean up).
// The lock goes when the database is closed, or when the process exits.
//
// The lock alone isn't enough for Next.js's probe. A probe that fails (on
// this lock, say) counts as "completed", and Next.js then turns the real page
// request into a 500 "deadlock" error (seen in task 14). So helper processes
// never open the folder at all (`openForThisProcess` in index.ts): their read
// never finishes, which the probe counts as "inconclusive". The lock catches
// every other second process, such as a second `npm run dev`.

import "server-only";

import { randomUUID } from "node:crypto";
import fs from "node:fs";

export type FolderLock = {
  /** Deletes the lock file, if it's still this lock's. Safe to call twice. */
  release(): void;
};

/** The lock file for a data folder: ".pglite" -> ".pglite.lock". */
export function lockPathFor(dataDir: string): string {
  return `${dataDir.replace(/[\\/]+$/, "")}.lock`;
}

type Holder = { pid: number; token: string };

/** Who holds the lock, or null when there's no lock file. */
function readHolder(lockPath: string): Holder | null {
  let text: string;
  try {
    text = fs.readFileSync(lockPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const [pid = "", token = ""] = text.split("\n");
  return { pid: Number(pid), token };
}

/** Whether a process with this id is running. */
function isRunning(pid: number): boolean {
  try {
    // Signal 0 sends nothing: it only checks that the process exists.
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return false; // no such process
    if (code === "EPERM") return true; // it exists, but belongs to another user
    throw error;
  }
}

/** Creates the lock file with `content`, or returns false if it already exists. */
function tryCreate(lockPath: string, content: string): boolean {
  let fd: number;
  try {
    fd = fs.openSync(lockPath, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
  try {
    fs.writeSync(fd, content);
  } finally {
    fs.closeSync(fd);
  }
  return true;
}

// The locks this process holds, released when it exits (a dev server that's
// stopped, a test run that ends). One "exit" listener for all of them,
// added with the first lock, never when this file is imported.
const heldLocks = new Set<FolderLock>();
let exitListenerAdded = false;

function releaseOnExit(lock: FolderLock): void {
  heldLocks.add(lock);
  if (exitListenerAdded) return;
  exitListenerAdded = true;
  process.on("exit", () => {
    for (const held of heldLocks) held.release();
  });
}

/**
 * Locks `dataDir` for this process, or throws if another running process
 * (or an earlier open in this one) has it.
 */
export function lockFolder(dataDir: string): FolderLock {
  const lockPath = lockPathFor(dataDir);
  const token = randomUUID();

  // Two tries: the second one follows taking over a stale lock.
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (tryCreate(lockPath, `${process.pid}\n${token}\n`)) {
      let released = false;
      const lock: FolderLock = {
        release() {
          if (released) return;
          released = true;
          heldLocks.delete(lock);
          // Only delete our own lock, never one another process took over.
          if (readHolder(lockPath)?.token === token) fs.rmSync(lockPath, { force: true });
        },
      };
      releaseOnExit(lock);
      return lock;
    }

    const holder = readHolder(lockPath);
    // Deleted between our two calls: try again.
    if (holder === null) continue;
    const knownPid = Number.isInteger(holder.pid) && holder.pid > 0;
    // An unreadable lock counts as held: better a clear error than a corrupted folder.
    if (!knownPid || isRunning(holder.pid)) {
      const who = knownPid ? `process ${holder.pid}` : "a process whose id the lock file doesn't show";
      throw new Error(
        `The local database (${dataDir}) is already open by ${who}. ` +
          "PGlite allows one process at a time: two would corrupt it. Stop the other process " +
          `(another \`npm run dev\`, or a helper Next.js started). If none is running, delete ${lockPath}.`,
      );
    }
    // The process that held it is gone: take the lock over.
    fs.rmSync(lockPath, { force: true });
  }

  throw new Error(`Couldn't lock the local database (${dataDir}): other processes keep taking the lock.`);
}
