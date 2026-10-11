import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { messages, outboundJobs, sequenceEnrollments, sequences, users } from "@/db/schema";
import { textToHtml } from "@/components/compose/rich-text-utils";
import { sendEmail } from "@/lib/email/send";
import { recipientAddresses } from "@/lib/email/send-conditions-utils";
import { normalizeMessageId, parseMessageIdList } from "@/lib/email/threading";
import { newId } from "@/lib/ids";
import { normalizeTimeZone } from "@/lib/time/utils";
import type { EnrollmentStatus, EnrollmentStepView, EnrollmentView, SequenceStats, SequenceStep, SequenceStepInput, SequenceSummary, StartEnrollmentInput } from "./types";
import { applyStepEdit, builtinVariables, missingVariables, normalizeSequenceSteps, renderHtmlFields, renderTemplate, replySubject, sequenceVariables, stepDays, stepSendTime } from "./utils";

type Db = ReturnType<typeof getDb>;
type EnrollmentRow = typeof sequenceEnrollments.$inferSelect;
type SequenceRow = typeof sequences.$inferSelect;

function parseJson<T>(value: string | null | undefined, fallback: T): T {
	if (!value) return fallback;
	try { return JSON.parse(value) as T; } catch { return fallback; }
}

const emptyStats = (): SequenceStats => ({ active: 0, replied: 0, finished: 0, stopped: 0, total: 0 });

function toSummary(row: SequenceRow, stats?: SequenceStats): SequenceSummary {
	const steps = parseJson<SequenceStep[]>(row.steps, []);
	return { id: row.id, name: row.name, steps, variables: sequenceVariables(steps), stats: stats ?? emptyStats(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

async function statsFor(db: Db, sequenceIds: string[]): Promise<Map<string, SequenceStats>> {
	const result = new Map<string, SequenceStats>();
	if (!sequenceIds.length) return result;
	const rows = await db
		.select({ sequenceId: sequenceEnrollments.sequenceId, status: sequenceEnrollments.status, count: sql<number>`count(*)` })
		.from(sequenceEnrollments)
		.where(inArray(sequenceEnrollments.sequenceId, sequenceIds))
		.groupBy(sequenceEnrollments.sequenceId, sequenceEnrollments.status);
	for (const row of rows) {
		const stats = result.get(row.sequenceId) ?? emptyStats();
		const count = Number(row.count);
		stats.total += count;
		if (row.status === "active") stats.active += count;
		else if (row.status === "replied") stats.replied += count;
		else if (row.status === "finished") stats.finished += count;
		else stats.stopped += count;
		result.set(row.sequenceId, stats);
	}
	return result;
}

export async function listSequences(env: CloudflareEnv, userId: string): Promise<SequenceSummary[]> {
	const db = getDb(env);
	const rows = await db.select().from(sequences).where(and(eq(sequences.userId, userId), isNull(sequences.archivedAt))).orderBy(desc(sequences.updatedAt));
	const stats = await statsFor(db, rows.map((row) => row.id));
	return rows.map((row) => toSummary(row, stats.get(row.id)));
}

async function ownSequence(db: Db, userId: string, sequenceId: string): Promise<SequenceRow> {
	const [row] = await db.select().from(sequences).where(and(eq(sequences.id, sequenceId), eq(sequences.userId, userId))).limit(1);
	if (!row || row.archivedAt) throw new Error("Sequence not found");
	return row;
}

export async function getSequence(env: CloudflareEnv, userId: string, sequenceId: string): Promise<SequenceSummary> {
	const db = getDb(env);
	const row = await ownSequence(db, userId, sequenceId);
	return toSummary(row, (await statsFor(db, [row.id])).get(row.id));
}

export async function createSequence(env: CloudflareEnv, userId: string, input: { name: string; steps: unknown }): Promise<SequenceSummary> {
	const name = String(input.name ?? "").trim();
	if (!name || name.length > 120) throw new Error("Give the sequence a name (up to 120 characters)");
	const steps = normalizeSequenceSteps(input.steps);
	const now = new Date();
	const [row] = await getDb(env).insert(sequences).values({ id: newId("seq"), userId, name, steps: JSON.stringify(steps), createdAt: now, updatedAt: now }).returning();
	return toSummary(row);
}

/** Changes the template. People already in the sequence keep the emails they started with. */
export async function updateSequence(env: CloudflareEnv, userId: string, sequenceId: string, input: { name?: string; steps?: unknown }): Promise<SequenceSummary> {
	const db = getDb(env);
	await ownSequence(db, userId, sequenceId);
	const changes: Partial<SequenceRow> = { updatedAt: new Date() };
	if (input.name !== undefined) {
		const name = String(input.name).trim();
		if (!name || name.length > 120) throw new Error("Give the sequence a name (up to 120 characters)");
		changes.name = name;
	}
	if (input.steps !== undefined) changes.steps = JSON.stringify(normalizeSequenceSteps(input.steps));
	await db.update(sequences).set(changes).where(eq(sequences.id, sequenceId));
	return getSequence(env, userId, sequenceId);
}

/** Archives the template; anyone mid-sequence keeps going unless stopped. */
export async function deleteSequence(env: CloudflareEnv, userId: string, sequenceId: string): Promise<{ id: string; deleted: true }> {
	const db = getDb(env);
	await ownSequence(db, userId, sequenceId);
	await db.update(sequences).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(sequences.id, sequenceId));
	return { id: sequenceId, deleted: true };
}

/** Enrolls one recipient and sends (or schedules) the opening. Later steps are created
 * one at a time as each previous step goes out. */
export async function startEnrollment(env: CloudflareEnv, userId: string, input: StartEnrollmentInput): Promise<EnrollmentView & { openingMessageId: string }> {
	const db = getDb(env);
	const sequence = await ownSequence(db, userId, input.sequenceId);
	let steps = parseJson<SequenceStep[]>(sequence.steps, []);
	if (!steps.length) throw new Error("This sequence has no emails");
	for (const [key, edit] of Object.entries(input.stepOverrides ?? {})) {
		const position = Number(key);
		if (!Number.isInteger(position) || position < 1 || position >= steps.length) continue;
		steps = steps.map((step, index) => index === position ? applyStepEdit(step, edit, index) : step);
	}
	const variables = { ...builtinVariables(input.to), ...cleanVariables(input.variables) };
	const opening = input.opening ?? null;
	const missing = missingVariables(opening ? steps.slice(1) : steps, variables);
	if (missing.length) throw new Error(`Fill in ${missing.map((name) => `{{${name}}}`).join(", ")} before starting this sequence`);

	const [user] = await db.select({ timeZone: users.timeZone }).from(users).where(eq(users.id, userId)).limit(1);
	// Without a zone from the caller or the profile, reuse the one this person's last sequence ran in.
	const [previous] = input.timeZone || user?.timeZone ? [] : await db.select({ timeZone: sequenceEnrollments.timeZone }).from(sequenceEnrollments)
		.where(and(eq(sequenceEnrollments.userId, userId), ne(sequenceEnrollments.timeZone, "UTC"))).orderBy(desc(sequenceEnrollments.createdAt)).limit(1);
	const timeZone = normalizeTimeZone(input.timeZone || user?.timeZone || previous?.timeZone || "UTC");
	const now = new Date();
	const enrollmentId = newId("enr");
	await db.insert(sequenceEnrollments).values({
		id: enrollmentId, sequenceId: sequence.id, userId, mailboxId: input.mailboxId,
		fromAddr: input.from, toAddr: input.to, ccAddr: input.cc || null,
		addresses: JSON.stringify(recipientAddresses(input.to, input.cc)),
		variables: JSON.stringify(variables), steps: JSON.stringify(steps), timeZone,
		status: "active", sentSteps: 0, nextStep: 0, createdAt: now, updatedAt: now,
	});

	const subject = opening ? opening.subject : renderTemplate(steps[0].subject, variables).text;
	const text = opening ? opening.text ?? undefined : renderTemplate(steps[0].body, variables).text;
	const html = opening ? opening.html ?? (opening.text ? textToHtml(opening.text) : undefined) : steps[0].html ? renderHtmlFields(steps[0].html, variables) : textToHtml(text);
	let openingMessageId: string;
	try {
		const result = await sendEmail(env, {
			userId, mailboxId: input.mailboxId, from: input.from, to: input.to,
			cc: input.cc || undefined, bcc: opening?.bcc || undefined,
			subject, text, html,
			inReplyTo: opening?.inReplyTo ?? null, references: opening?.references ?? null, threadId: opening?.threadId ?? null,
			attachments: input.attachments,
			scheduledAt: input.scheduledAt ?? undefined,
			condition: input.openingCondition ?? null,
			sequenceStep: { enrollmentId, position: 0 },
			publicOrigin: input.publicOrigin,
		});
		openingMessageId = result.messageId;
		if (result.scheduled) {
			await db.update(sequenceEnrollments).set({ nextMessageId: result.messageId, updatedAt: new Date() })
				.where(and(eq(sequenceEnrollments.id, enrollmentId), eq(sequenceEnrollments.sentSteps, 0)));
		}
	} catch (error) {
		await db.update(sequenceEnrollments).set({ status: "failed", nextStep: null, updatedAt: new Date() }).where(eq(sequenceEnrollments.id, enrollmentId));
		throw error;
	}
	return { ...(await getEnrollment(env, userId, enrollmentId)), openingMessageId };
}

function cleanVariables(value: Record<string, string> | undefined): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [key, raw] of Object.entries(value ?? {})) {
		if (!/^[a-zA-Z]\w{0,40}$/.test(key)) continue;
		const text = String(raw ?? "").trim();
		if (text) out[key] = text.slice(0, 2_000);
	}
	return out;
}

/** Called by the outbound pipeline after a sequence email is delivered. */
export async function onSequenceStepSent(env: CloudflareEnv, input: { enrollmentId: string; position: number; messageId: string }): Promise<void> {
	const db = getDb(env);
	const [enrollment] = await db.select().from(sequenceEnrollments).where(eq(sequenceEnrollments.id, input.enrollmentId)).limit(1);
	if (!enrollment || (enrollment.status !== "active" && enrollment.status !== "replied")) return;
	const [sent] = await db.select({ threadId: messages.threadId }).from(messages).where(eq(messages.id, input.messageId)).limit(1);
	const threadIds = new Set(parseJson<string[]>(enrollment.threadIds, []));
	if (sent?.threadId) threadIds.add(sent.threadId);
	const now = new Date();
	const [updated] = await db.update(sequenceEnrollments).set({
		sentSteps: input.position + 1, lastMessageId: input.messageId, lastSentAt: now,
		threadIds: JSON.stringify([...threadIds]), nextStep: null, nextMessageId: null, updatedAt: now,
	}).where(eq(sequenceEnrollments.id, enrollment.id)).returning();
	await scheduleNextStep(env, updated, input.position + 1, now);
}

/** Creates the next eligible step as a scheduled email, or finishes the enrollment. */
async function scheduleNextStep(env: CloudflareEnv, enrollment: EnrollmentRow, fromPosition: number, base: Date): Promise<void> {
	const db = getDb(env);
	const steps = parseJson<SequenceStep[]>(enrollment.steps, []);
	let position = fromPosition;
	while (position < steps.length && enrollment.repliedAt && steps[position].condition === "no_reply") position += 1;
	if (position >= steps.length) {
		await db.update(sequenceEnrollments).set({ status: enrollment.status === "replied" ? "replied" : "finished", nextStep: null, nextMessageId: null, updatedAt: new Date() }).where(eq(sequenceEnrollments.id, enrollment.id));
		return;
	}
	const step = steps[position];
	const variables = parseJson<Record<string, string>>(enrollment.variables, {});
	const [last] = enrollment.lastMessageId
		? await db.select({ subject: messages.subject, threadId: messages.threadId, providerMessageId: messages.providerMessageId, references: messages.references }).from(messages).where(eq(messages.id, enrollment.lastMessageId)).limit(1)
		: [];
	const isReply = step.kind === "reply" && !!last;
	const lastMessageHeader = normalizeMessageId(last?.providerMessageId);
	const references = isReply ? [...parseMessageIdList(last?.references), ...(lastMessageHeader ? [lastMessageHeader] : [])] : [];
	const text = renderTemplate(step.body, variables).text;
	const sendAt = stepSendTime(base, step, enrollment.timeZone);
	try {
		const result = await sendEmail(env, {
			userId: enrollment.userId, mailboxId: enrollment.mailboxId, from: enrollment.fromAddr,
			to: enrollment.toAddr, cc: enrollment.ccAddr || undefined,
			subject: isReply ? replySubject(last?.subject) : renderTemplate(step.subject, variables).text,
			text, html: step.html ? renderHtmlFields(step.html, variables) : textToHtml(text),
			inReplyTo: isReply ? lastMessageHeader : null,
			references: isReply ? references : null,
			threadId: isReply ? last?.threadId ?? null : null,
			scheduledAt: sendAt,
			condition: step.condition === "no_reply" ? "no_reply" : null,
			sequenceStep: { enrollmentId: enrollment.id, position },
		});
		if (result.scheduled) {
			await db.update(sequenceEnrollments).set({ nextStep: position, nextMessageId: result.messageId, updatedAt: new Date() })
				.where(and(eq(sequenceEnrollments.id, enrollment.id), eq(sequenceEnrollments.sentSteps, enrollment.sentSteps)));
		}
	} catch (error) {
		console.error("sequence step failed", enrollment.id, position, error);
		await db.update(sequenceEnrollments).set({ status: "failed", nextStep: null, nextMessageId: null, updatedAt: new Date() }).where(eq(sequenceEnrollments.id, enrollment.id));
	}
}

/** A sequence email failed at the provider. */
export async function onSequenceStepFailed(env: CloudflareEnv, input: { enrollmentId: string }): Promise<void> {
	await getDb(env).update(sequenceEnrollments).set({ status: "failed", nextStep: null, updatedAt: new Date() }).where(eq(sequenceEnrollments.id, input.enrollmentId));
}

/** Someone wrote back. Marks matching enrollments replied; their held-back next email is
 * discarded, and any later "always" step is still scheduled. */
export async function handleSequenceReply(
	env: CloudflareEnv,
	reply: { mailboxId: string; threadId: string | null; fromAddr: string; receivedAt: Date },
	skipped: { messageId: string; scheduledAt: Date | null }[],
): Promise<number> {
	const db = getDb(env);
	const rows = await db.select().from(sequenceEnrollments).where(and(eq(sequenceEnrollments.mailboxId, reply.mailboxId), inArray(sequenceEnrollments.status, ["active"])));
	const from = recipientAddresses(reply.fromAddr);
	let matched = 0;
	for (const row of rows) {
		if (row.createdAt.getTime() > reply.receivedAt.getTime()) continue;
		const addresses = parseJson<string[]>(row.addresses, []);
		const threads = parseJson<string[]>(row.threadIds, []);
		if (!(reply.threadId && threads.includes(reply.threadId)) && !from.some((address) => addresses.includes(address))) continue;
		const claimed = await db.update(sequenceEnrollments).set({ status: "replied", repliedAt: reply.receivedAt, repliedFrom: reply.fromAddr, updatedAt: new Date() })
			.where(and(eq(sequenceEnrollments.id, row.id), eq(sequenceEnrollments.status, "active"))).returning();
		if (!claimed.length) continue;
		matched += 1;
		const held = skipped.find((item) => item.messageId === row.nextMessageId);
		if (!held || row.nextStep === null) continue;
		await trashMessage(db, held.messageId);
		await db.update(sequenceEnrollments).set({ nextStep: null, nextMessageId: null }).where(eq(sequenceEnrollments.id, row.id));
		await scheduleNextStep(env, { ...claimed[0], nextStep: null, nextMessageId: null }, row.nextStep + 1, held.scheduledAt ?? new Date());
	}
	return matched;
}

async function trashMessage(db: Db, messageId: string) {
	await db.update(messages).set({ status: "trash", trashedAt: new Date() }).where(and(eq(messages.id, messageId), inArray(messages.status, ["draft", "queued"])));
}

/** Removes the pending scheduled email of an enrollment. Returns its scheduled time. */
async function withdrawNextStep(db: Db, enrollment: EnrollmentRow): Promise<{ scheduledAt: Date | null } | null> {
	if (!enrollment.nextMessageId) return null;
	const [message] = await db.select({ status: messages.status }).from(messages).where(eq(messages.id, enrollment.nextMessageId)).limit(1);
	if (message?.status === "queued") {
		const deleted = await db.delete(outboundJobs)
			.where(and(eq(outboundJobs.messageId, enrollment.nextMessageId), eq(outboundJobs.status, "queued")))
			.returning({ scheduledAt: outboundJobs.scheduledAt });
		if (!deleted.length) throw new Error("The next email is already being sent");
		await trashMessage(db, enrollment.nextMessageId);
		return { scheduledAt: deleted[0].scheduledAt };
	}
	// Cancelled to Drafts by hand: leave the person's draft where it is.
	return { scheduledAt: null };
}

async function ownEnrollment(db: Db, userId: string, enrollmentId: string): Promise<EnrollmentRow> {
	const [row] = await db.select().from(sequenceEnrollments).where(and(eq(sequenceEnrollments.id, enrollmentId), eq(sequenceEnrollments.userId, userId))).limit(1);
	if (!row) throw new Error("Sequence enrollment not found");
	return row;
}

export async function stopEnrollment(env: CloudflareEnv, userId: string, enrollmentId: string): Promise<EnrollmentView> {
	const db = getDb(env);
	const row = await ownEnrollment(db, userId, enrollmentId);
	if (row.status === "active" || (row.status === "replied" && row.nextMessageId)) {
		await withdrawNextStep(db, row);
		await db.update(sequenceEnrollments).set({ status: row.status === "replied" ? "replied" : "stopped", nextStep: null, nextMessageId: null, updatedAt: new Date() }).where(eq(sequenceEnrollments.id, row.id));
	}
	return getEnrollment(env, userId, enrollmentId);
}

/** Drops the pending step and schedules the one after it, timed from when the skipped one was due. */
export async function skipEnrollmentStep(env: CloudflareEnv, userId: string, enrollmentId: string): Promise<EnrollmentView> {
	const db = getDb(env);
	const row = await ownEnrollment(db, userId, enrollmentId);
	if (row.nextStep === null || !row.nextMessageId) throw new Error("There is no upcoming email to skip");
	if (row.nextStep === 0) throw new Error("The opening has not been sent yet; stop the sequence instead");
	const withdrawn = await withdrawNextStep(db, row);
	const [updated] = await db.update(sequenceEnrollments).set({ nextStep: null, nextMessageId: null, updatedAt: new Date() }).where(eq(sequenceEnrollments.id, row.id)).returning();
	await scheduleNextStep(env, updated, row.nextStep + 1, withdrawn?.scheduledAt ?? new Date());
	return getEnrollment(env, userId, enrollmentId);
}

/** Edits this person's copy of a step that has not gone out yet. Editing the pending step
 * re-creates its scheduled email with the new content and timing. */
export async function editEnrollmentStep(env: CloudflareEnv, userId: string, enrollmentId: string, position: number, edit: SequenceStepInput): Promise<EnrollmentView> {
	const db = getDb(env);
	const row = await ownEnrollment(db, userId, enrollmentId);
	const steps = parseJson<SequenceStep[]>(row.steps, []);
	if (!Number.isInteger(position) || position < 1 || position >= steps.length) throw new Error("Step not found");
	if (position < row.sentSteps) throw new Error("That email has already been sent");
	const next = steps.map((step, index) => index === position ? applyStepEdit(step, edit, index) : step);
	const variables = parseJson<Record<string, string>>(row.variables, {});
	const missing = missingVariables([next[position]], variables);
	if (missing.length) throw new Error(`Unknown placeholder ${missing.map((name) => `{{${name}}}`).join(", ")}`);
	await db.update(sequenceEnrollments).set({ steps: JSON.stringify(next), updatedAt: new Date() }).where(eq(sequenceEnrollments.id, row.id));
	if (row.nextStep === position && row.nextMessageId && (row.status === "active" || row.status === "replied")) {
		const [message] = await db.select({ status: messages.status }).from(messages).where(eq(messages.id, row.nextMessageId)).limit(1);
		if (message?.status === "queued") {
			await withdrawNextStep(db, row);
			const [updated] = await db.update(sequenceEnrollments).set({ nextStep: null, nextMessageId: null }).where(eq(sequenceEnrollments.id, row.id)).returning();
			await scheduleNextStep(env, updated, position, row.lastSentAt ?? new Date());
		}
	}
	return getEnrollment(env, userId, enrollmentId);
}

export async function getEnrollment(env: CloudflareEnv, userId: string, enrollmentId: string): Promise<EnrollmentView> {
	const db = getDb(env);
	const row = await ownEnrollment(db, userId, enrollmentId);
	return (await toViews(db, [row]))[0];
}

export async function listEnrollments(env: CloudflareEnv, userId: string, filter: { sequenceId?: string; status?: EnrollmentStatus; mailboxId?: string; limit?: number } = {}): Promise<EnrollmentView[]> {
	const db = getDb(env);
	const conditions = [eq(sequenceEnrollments.userId, userId)];
	if (filter.sequenceId) conditions.push(eq(sequenceEnrollments.sequenceId, filter.sequenceId));
	if (filter.status) conditions.push(eq(sequenceEnrollments.status, filter.status));
	if (filter.mailboxId) conditions.push(eq(sequenceEnrollments.mailboxId, filter.mailboxId));
	const rows = await db.select().from(sequenceEnrollments).where(and(...conditions)).orderBy(desc(sequenceEnrollments.createdAt)).limit(Math.min(filter.limit ?? 50, 200));
	return toViews(db, rows);
}

/** The enrollment, if any, that a message belongs to: by thread, or as its pending next email. */
export async function findEnrollmentForMessage(env: CloudflareEnv, userId: string, messageId: string): Promise<EnrollmentView | null> {
	const db = getDb(env);
	const [message] = await db.select({ threadId: messages.threadId, mailboxId: messages.mailboxId }).from(messages).where(eq(messages.id, messageId)).limit(1);
	if (!message?.mailboxId) return null;
	const rows = await db.select().from(sequenceEnrollments)
		.where(and(eq(sequenceEnrollments.userId, userId), eq(sequenceEnrollments.mailboxId, message.mailboxId)))
		.orderBy(desc(sequenceEnrollments.createdAt)).limit(500);
	const match = rows.find((row) => row.nextMessageId === messageId || row.lastMessageId === messageId || (!!message.threadId && parseJson<string[]>(row.threadIds, []).includes(message.threadId)));
	return match ? (await toViews(db, [match]))[0] : null;
}

/** The active enrollment whose pending email is this (hand-cancelled) draft. */
export async function findEnrollmentByPendingDraft(env: CloudflareEnv, userId: string, draftId: string): Promise<{ enrollmentId: string; position: number } | null> {
	const [row] = await getDb(env).select({ id: sequenceEnrollments.id, nextStep: sequenceEnrollments.nextStep, status: sequenceEnrollments.status })
		.from(sequenceEnrollments).where(and(eq(sequenceEnrollments.userId, userId), eq(sequenceEnrollments.nextMessageId, draftId))).limit(1);
	return row && row.nextStep !== null && (row.status === "active" || row.status === "replied") ? { enrollmentId: row.id, position: row.nextStep } : null;
}

/** A hand-edited sequence step was rescheduled from Drafts as a new message. */
export async function relinkPendingStep(env: CloudflareEnv, enrollmentId: string, draftId: string, messageId: string): Promise<void> {
	await getDb(env).update(sequenceEnrollments).set({ nextMessageId: messageId, updatedAt: new Date() })
		.where(and(eq(sequenceEnrollments.id, enrollmentId), eq(sequenceEnrollments.nextMessageId, draftId)));
}

async function toViews(db: Db, rows: EnrollmentRow[]): Promise<EnrollmentView[]> {
	if (!rows.length) return [];
	const sequenceRows = await db.select({ id: sequences.id, name: sequences.name }).from(sequences).where(inArray(sequences.id, [...new Set(rows.map((row) => row.sequenceId))]));
	const names = new Map(sequenceRows.map((row) => [row.id, row.name]));
	const nextIds = rows.map((row) => row.nextMessageId).filter((id): id is string => !!id);
	const pending = nextIds.length
		? await db.select({ messageId: messages.id, status: messages.status, scheduledAt: outboundJobs.scheduledAt })
			.from(messages).leftJoin(outboundJobs, and(eq(outboundJobs.messageId, messages.id), eq(outboundJobs.status, "queued")))
			.where(inArray(messages.id, nextIds))
		: [];
	const pendingById = new Map(pending.map((row) => [row.messageId, row]));
	return rows.map((row) => {
		const steps = parseJson<SequenceStep[]>(row.steps, []);
		const days = stepDays(steps);
		const next = row.nextMessageId ? pendingById.get(row.nextMessageId) : undefined;
		const nextSendAt = next?.status === "queued" && next.scheduledAt ? next.scheduledAt.toISOString() : null;
		const ended = row.status !== "active" && !(row.status === "replied" && row.nextMessageId);
		const stepViews: EnrollmentStepView[] = steps.map((step, position) => {
			let state: EnrollmentStepView["state"] = "upcoming";
			if (position < row.sentSteps) state = "sent";
			else if (position === row.nextStep) state = next?.status === "queued" ? "scheduled" : "paused";
			else if (ended || (row.nextStep !== null && position < row.nextStep) || (row.repliedAt && step.condition === "no_reply")) state = "skipped";
			return { ...step, position, day: days[position], state, messageId: position === row.nextStep ? row.nextMessageId : position === row.sentSteps - 1 ? row.lastMessageId : null, scheduledAt: position === row.nextStep ? nextSendAt : null };
		});
		return {
			id: row.id, sequenceId: row.sequenceId, sequenceName: names.get(row.sequenceId) ?? "", mailboxId: row.mailboxId,
			from: row.fromAddr, to: row.toAddr, cc: row.ccAddr, status: row.status as EnrollmentStatus,
			variables: parseJson<Record<string, string>>(row.variables, {}), timeZone: row.timeZone,
			sentSteps: row.sentSteps, nextStep: row.nextStep, nextMessageId: row.nextMessageId, nextSendAt,
			repliedAt: row.repliedAt?.toISOString() ?? null, repliedFrom: row.repliedFrom, createdAt: row.createdAt.toISOString(),
			steps: stepViews,
		};
	});
}
