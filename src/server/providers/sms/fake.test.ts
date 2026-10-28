import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createFakeSmsProvider } from "./fake";

const message = { to: "+919876543210", text: "123456 is your login code." };

let folder: string;
beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "gomechanic-outbox-"));
});
afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("the fake SMS provider", () => {
  test("stores the message as an SMS for /dev/outbox", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await createFakeSmsProvider({ save, outboxFile: undefined }).send(message);
    expect(save).toHaveBeenCalledWith({ channel: "sms", recipient: message.to, body: message.text });
  });

  test("with an outbox file, also adds one JSON line the browser tests can read", async () => {
    const outboxFile = path.join(folder, "outbox.jsonl");
    const provider = createFakeSmsProvider({ save: vi.fn().mockResolvedValue(undefined), outboxFile });
    await provider.send(message);
    await provider.send({ ...message, text: "654321 is your login code." });

    const lines = fs.readFileSync(outboxFile, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(lines).toEqual([
      { to: message.to, text: message.text, sentAt: expect.any(String) },
      { to: message.to, text: "654321 is your login code.", sentAt: expect.any(String) },
    ]);
    expect(Number.isNaN(Date.parse(lines[0].sentAt))).toBe(false);
  });

  test("without an outbox file, writes no file", async () => {
    await createFakeSmsProvider({ save: vi.fn().mockResolvedValue(undefined), outboxFile: undefined }).send(message);
    expect(fs.readdirSync(folder)).toEqual([]);
  });

  test("passes a storage failure on unchanged, and logs nothing", async () => {
    const failure = new Error("database down");
    const log = vi.spyOn(console, "log");
    const error = vi.spyOn(console, "error");
    const provider = createFakeSmsProvider({ save: vi.fn().mockRejectedValue(failure), outboxFile: undefined });

    await expect(provider.send(message)).rejects.toBe(failure);
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
