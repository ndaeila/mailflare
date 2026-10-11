import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = mkdtempSync(join(tmpdir(), "mailflare-sequences-"));
after(() => rmSync(outDir, { recursive: true, force: true }));
await build({
	entryPoints: [join(root, "src/lib/sequences/utils.ts")],
	outfile: join(outDir, "sequences.mjs"),
	bundle: true, platform: "node", format: "esm", target: "node22", logLevel: "silent",
	alias: { "@": join(root, "src") },
});
const s = await import(pathToFileURL(join(outDir, "sequences.mjs")).href);

const steps = s.normalizeSequenceSteps([
	{ subject: "Your {{topic}} research", body: "Hi {{first_name}}, I read your work on {{topic}}." },
	{ kind: "reply", delayDays: 4, sendTime: "09:00", body: "Hi {{first_name}}, quick bump on this." },
	{ kind: "new", delayDays: 6, subject: "One more idea", body: "Separate thought." },
]);

test("the first step is always the opening and sends unconditionally", () => {
	assert.equal(steps[0].kind, "opening");
	assert.equal(steps[0].delayDays, 0);
	assert.equal(steps[0].condition, "always");
	assert.equal(steps[1].condition, "no_reply");
	assert.equal(steps[1].subject, "");
});

test("bad steps are rejected with a readable message", () => {
	assert.throws(() => s.normalizeSequenceSteps([]), /opening/);
	assert.throws(() => s.normalizeSequenceSteps([{ body: "no subject" }]), /needs a subject/);
	assert.throws(() => s.normalizeSequenceSteps([{ subject: "a", body: "b" }, { body: "x", sendTime: "9am" }]), /HH:MM/);
});

test("variables exclude the built-ins taken from the recipient", () => {
	assert.deepEqual(s.sequenceVariables(steps), ["topic"]);
	assert.deepEqual(s.builtinVariables("Christopher Whaley <chris@brown.edu>"), { email: "chris@brown.edu", name: "Christopher Whaley", first_name: "Christopher", last_name: "Whaley" });
	assert.equal(s.builtinVariables("chris@brown.edu").first_name, "");
});

test("rendering fills placeholders and reports what is missing", () => {
	const vars = { ...s.builtinVariables("Ana Ruiz <ana@x.org>"), topic: "TiC prices" };
	assert.equal(s.renderTemplate(steps[0].body, vars).text, "Hi Ana, I read your work on TiC prices.");
	assert.deepEqual(s.missingVariables(steps, s.builtinVariables("ana@x.org")), ["topic", "first_name"]);
});

test("day offsets add up the delays", () => {
	assert.deepEqual(s.stepDays(steps), [0, 4, 10]);
});

test("send time lands on the local clock time, days later", () => {
	const sent = new Date("2026-10-13T20:30:00Z"); // 1:30 PM in Los Angeles
	const at = s.stepSendTime(sent, steps[1], "America/Los_Angeles");
	assert.equal(at.toISOString(), "2026-10-17T16:00:00.000Z"); // Oct 17, 9:00 AM PDT
});

test("a same-day send time already past moves to the next day", () => {
	const at = s.stepSendTime(new Date("2026-10-13T20:30:00Z"), { delayDays: 0, sendTime: "09:00" }, "America/Los_Angeles");
	assert.equal(at.toISOString(), "2026-10-14T16:00:00.000Z");
});

test("without a send time the delay is exact", () => {
	const at = s.stepSendTime(new Date("2026-10-13T20:30:00Z"), { delayDays: 2, sendTime: null }, "UTC");
	assert.equal(at.toISOString(), "2026-10-15T20:30:00.000Z");
});

test("reply subjects are not doubled", () => {
	assert.equal(s.replySubject("Hello"), "Re: Hello");
	assert.equal(s.replySubject("RE: Hello"), "RE: Hello");
});

test("html bodies get escaped field values and unknown fields stay", () => {
	assert.equal(s.renderHtmlFields("<div>Hi {{first_name}}, about {{topic}}</div>", { first_name: "A<b>" }), "<div>Hi A&lt;b&gt;, about {{topic}}</div>");
});

test("a new plain body drops the old rich body", () => {
	const step = s.normalizeStep({ kind: "reply", delayDays: 2, body: "old", html: "<div>old</div>" }, 1);
	assert.equal(step.html, "<div>old</div>");
	assert.equal(s.applyStepEdit(step, { body: "new" }, 1).html, null);
	assert.equal(s.applyStepEdit(step, { delayDays: 3 }, 1).html, "<div>old</div>");
});
