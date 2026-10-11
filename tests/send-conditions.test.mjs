import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = mkdtempSync(join(tmpdir(), "mailflare-send-conditions-"));
after(() => rmSync(outDir, { recursive: true, force: true }));
await build({
	entryPoints: [join(root, "src/lib/email/send-conditions-utils.ts")],
	outfile: join(outDir, "conditions.mjs"),
	bundle: true, platform: "node", format: "esm", target: "node22", logLevel: "silent",
	alias: { "@": join(root, "src") },
});
const c = await import(pathToFileURL(join(outDir, "conditions.mjs")).href);

const since = new Date("2026-10-12T17:00:00Z");
const condition = c.buildNoReplyCondition({ threadId: "thr_1", to: "Linda Park <Linda@NWMHA.org>", cc: ["ops@nwmha.org"], since });

test("recipient addresses are bare and lower-cased", () => {
	assert.deepEqual(condition.addresses, ["linda@nwmha.org", "ops@nwmha.org"]);
});

test("a reply in the thread after the send was scheduled matches", () => {
	assert.equal(c.conditionMatchesReply(condition, { threadId: "thr_1", fromAddr: "someone@else.org", receivedAt: new Date("2026-10-12T18:00:00Z") }), true);
});

test("a message from a recipient in another thread also matches", () => {
	assert.equal(c.conditionMatchesReply(condition, { threadId: "thr_9", fromAddr: "\"Linda\" <linda@nwmha.org>", receivedAt: new Date("2026-10-12T18:00:00Z") }), true);
});

test("earlier messages and unrelated senders do not match", () => {
	assert.equal(c.conditionMatchesReply(condition, { threadId: "thr_1", fromAddr: "linda@nwmha.org", receivedAt: new Date("2026-10-12T16:00:00Z") }), false);
	assert.equal(c.conditionMatchesReply(condition, { threadId: "thr_9", fromAddr: "stranger@example.com", receivedAt: new Date("2026-10-12T18:00:00Z") }), false);
});

test("stored conditions round-trip and junk is ignored", () => {
	assert.deepEqual(c.parseSendCondition(JSON.stringify(condition)), condition);
	assert.equal(c.parseSendCondition("not json"), null);
	assert.equal(c.parseSendCondition(JSON.stringify({ type: "other" })), null);
});
