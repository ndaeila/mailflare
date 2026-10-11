import { and, eq } from "drizzle-orm";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getDb } from "@/db";
import { domains, mailboxes, messages } from "@/db/schema";
import { formatAgentDraftBody } from "@/lib/agent/draft-format";
import { loadMessageAttachmentContents } from "@/lib/email/attachments";
import { getAuthorizedSenderAddress } from "@/lib/email/sender";
import type { McpPrincipal } from "@/lib/mcp/types";
import { createSequence, deleteSequence, editEnrollmentStep, findEnrollmentForMessage, getEnrollment, getSequence, listEnrollments, listSequences, skipEnrollmentStep, startEnrollment, stopEnrollment, updateSequence } from "./service";
import type { EnrollmentView, StartEnrollmentInput } from "./types";

const stepSchema = z.object({
	kind: z.enum(["opening", "reply", "new"]).optional().describe("Step 1 is always the opening. Later steps: \"reply\" (in the same thread, subject \"Re: ...\") or \"new\" (a fresh email with its own subject). Default reply."),
	delayDays: z.number().int().min(0).max(365).optional().describe("Days after the previous step was sent. Ignored for the opening. Default 3."),
	sendTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional().describe("Local HH:MM to send at, in the sender's time zone. Omit to send exactly delayDays later."),
	condition: z.enum(["no_reply", "always"]).optional().describe("\"no_reply\" (default) holds this step back once anyone replies; \"always\" sends regardless."),
	subject: z.string().max(500).optional().describe("Required for the opening and \"new\" steps; ignored for replies."),
	body: z.string().max(40_000).optional().describe("Plain text. Placeholders like {{first_name}}, {{last_name}}, {{name}}, {{email}} fill from the recipient; any other {{variable}} must be passed when starting."),
});

const stepsDescription = "Ordered emails. The first is the opening email template; each later one is a follow-up.";

function output(value: unknown, isError = false) {
	return { content: [{ type: "text" as const, text: JSON.stringify(value) }], isError };
}

function fail(error: unknown, fallback: string) {
	return output({ error: error instanceof Error ? error.message : fallback }, true);
}

/** Sequence tools for the Mailflare MCP server. Templates need mcp:read / mcp:draft;
 * starting one needs mcp:send because it sends the opening without review. */
export function registerSequenceMcpTools(server: McpServer, env: CloudflareEnv, principal: McpPrincipal) {
	const can = (scope: string) => principal.scopes.includes(scope);
	const userId = principal.user.id;
	const visible = (enrollment: EnrollmentView) => principal.mailboxIds.includes(enrollment.mailboxId);
	const ownEnrollment = async (enrollmentId: string) => {
		const enrollment = await getEnrollment(env, userId, enrollmentId);
		if (!visible(enrollment)) throw new Error("Sequence enrollment not found");
		return enrollment;
	};

	server.registerTool("list_sequences", { description: "List saved email sequences (an opening email template plus timed follow-ups) with their steps, the {{variables}} they need, and how many people are active, replied or finished.", inputSchema: z.object({}) }, async () => {
		if (!can("mcp:read")) return output({ error: "Permission denied" }, true);
		return output(await listSequences(env, userId));
	});

	server.registerTool("get_sequence", { description: "Read one sequence's steps and stats.", inputSchema: z.object({ sequenceId: z.string() }) }, async ({ sequenceId }) => {
		if (!can("mcp:read")) return output({ error: "Permission denied" }, true);
		try { return output(await getSequence(env, userId, sequenceId)); } catch (error) { return fail(error, "Sequence not found"); }
	});

	server.registerTool("create_sequence", { description: "Save a new sequence template. This never sends anything; use start_sequence to send it to someone.", inputSchema: z.object({ name: z.string().min(1).max(120), steps: z.array(stepSchema).min(1).max(10).describe(stepsDescription) }) }, async ({ name, steps }) => {
		if (!can("mcp:draft")) return output({ error: "Permission denied" }, true);
		try { return output(await createSequence(env, userId, { name, steps })); } catch (error) { return fail(error, "Could not create sequence"); }
	});

	server.registerTool("update_sequence", { description: "Rename a sequence or replace its steps (pass the full list). People already in it keep the emails they started with.", inputSchema: z.object({ sequenceId: z.string(), name: z.string().min(1).max(120).optional(), steps: z.array(stepSchema).min(1).max(10).optional().describe(stepsDescription) }) }, async ({ sequenceId, name, steps }) => {
		if (!can("mcp:draft")) return output({ error: "Permission denied" }, true);
		try { return output(await updateSequence(env, userId, sequenceId, { name, steps })); } catch (error) { return fail(error, "Could not update sequence"); }
	});

	server.registerTool("delete_sequence", { description: "Delete a sequence template. People already in it keep going unless you stop them with stop_sequence.", inputSchema: z.object({ sequenceId: z.string() }) }, async ({ sequenceId }) => {
		if (!can("mcp:draft")) return output({ error: "Permission denied" }, true);
		try { return output(await deleteSequence(env, userId, sequenceId)); } catch (error) { return fail(error, "Could not delete sequence"); }
	});

	server.registerTool("list_sequence_enrollments", { description: "List people in sequences with each step's state (sent, scheduled, upcoming, skipped) and when the next email goes out.", inputSchema: z.object({ sequenceId: z.string().optional(), status: z.enum(["active", "replied", "stopped", "finished", "failed"]).optional(), mailboxId: z.string().optional(), limit: z.number().int().min(1).max(200).optional() }) }, async ({ sequenceId, status, mailboxId, limit }) => {
		if (!can("mcp:read")) return output({ error: "Permission denied" }, true);
		if (mailboxId && !principal.mailboxIds.includes(mailboxId)) return output({ error: "Permission denied" }, true);
		return output((await listEnrollments(env, userId, { sequenceId, status, mailboxId, limit })).filter(visible));
	});

	server.registerTool("get_sequence_enrollment", { description: "Read one person's progress through a sequence, by enrollmentId or by any email in the thread (messageId).", inputSchema: z.object({ enrollmentId: z.string().optional(), messageId: z.string().optional() }) }, async ({ enrollmentId, messageId }) => {
		if (!can("mcp:read")) return output({ error: "Permission denied" }, true);
		try {
			if (enrollmentId) return output(await ownEnrollment(enrollmentId));
			if (messageId) {
				const found = await findEnrollmentForMessage(env, userId, messageId);
				return found && visible(found) ? output(found) : output({ error: "No sequence for this email" }, true);
			}
			return output({ error: "Pass enrollmentId or messageId" }, true);
		} catch (error) { return fail(error, "Sequence enrollment not found"); }
	});

	server.registerTool("update_sequence_step", { description: "Edit one person's copy of an upcoming step (position is 0-based; 0 is the opening). If it is the next scheduled email, it is rescheduled with the new content and timing. The sequence template is not changed.", inputSchema: z.object({ enrollmentId: z.string(), position: z.number().int().min(1), ...stepSchema.shape }) }, async ({ enrollmentId, position, ...edit }) => {
		if (!can("mcp:draft")) return output({ error: "Permission denied" }, true);
		try { await ownEnrollment(enrollmentId); return output(await editEnrollmentStep(env, userId, enrollmentId, position, edit)); } catch (error) { return fail(error, "Could not update step"); }
	});

	server.registerTool("skip_sequence_step", { description: "Skip this person's next scheduled email; the step after it is scheduled in its place.", inputSchema: z.object({ enrollmentId: z.string() }) }, async ({ enrollmentId }) => {
		if (!can("mcp:draft")) return output({ error: "Permission denied" }, true);
		try { await ownEnrollment(enrollmentId); return output(await skipEnrollmentStep(env, userId, enrollmentId)); } catch (error) { return fail(error, "Could not skip step"); }
	});

	server.registerTool("stop_sequence", { description: "Stop a sequence for one person. Their pending scheduled email is removed and nothing else is sent.", inputSchema: z.object({ enrollmentId: z.string() }) }, async ({ enrollmentId }) => {
		if (!can("mcp:draft")) return output({ error: "Permission denied" }, true);
		try { await ownEnrollment(enrollmentId); return output(await stopEnrollment(env, userId, enrollmentId)); } catch (error) { return fail(error, "Could not stop sequence"); }
	});

	if (!can("mcp:send")) return;
	server.registerTool("start_sequence", {
		description: "Start a sequence for one recipient without review in Mailflare: sends (or schedules, with sendAt) the opening, then each follow-up on its schedule until someone replies. For the opening, pass draftId to send one of your drafts as written (the template opening is not used and the draft is kept as step 1), or omit it to use the sequence's template opening. Pass values for the sequence's {{variables}}; first_name/last_name/name/email come from the recipient.",
		inputSchema: z.object({
			mailboxId: z.string(), sequenceId: z.string(),
			to: z.string().min(3).max(2_000).optional().describe("Recipient, e.g. \"Ana Ruiz <ana@example.com>\". Required unless draftId is given."),
			cc: z.string().max(2_000).optional(),
			draftId: z.string().optional().describe("An existing draft in this mailbox to send as the opening."),
			variables: z.record(z.string(), z.string()).optional(),
			stepOverrides: z.record(z.string(), stepSchema).optional().describe("This person's edits to later steps, keyed by position (\"1\", \"2\", ...)."),
			sendAt: z.string().max(40).optional().describe("ISO 8601 time with offset to schedule the opening instead of sending now."),
			timeZone: z.string().max(64).optional().describe("IANA zone (e.g. America/Los_Angeles) that step send times like 09:00 are in. Pass the user's zone; without it the account's zone, then the zone of their last sequence, then UTC is used."),
		}),
	}, async (args) => {
		if (!principal.mailboxIds.includes(args.mailboxId)) return output({ error: "Permission denied" }, true);
		const db = getDb(env);
		try {
			let opening: StartEnrollmentInput["opening"] = null;
			let to = args.to ?? "";
			let cc = args.cc ?? null;
			let from: string;
			let attachments;
			if (args.draftId) {
				const [draft] = await db.select().from(messages).where(and(eq(messages.id, args.draftId), eq(messages.mailboxId, args.mailboxId), eq(messages.status, "draft"))).limit(1);
				if (!draft) return output({ error: "Draft not found" }, true);
				to = args.to ?? draft.toAddr;
				cc = args.cc ?? draft.ccAddr;
				from = draft.fromAddr;
				opening = { subject: draft.subject ?? "", text: draft.textBody, html: draft.htmlBody, bcc: draft.bccAddr, inReplyTo: draft.inReplyTo, references: draft.references, threadId: draft.threadId };
				if (!draft.subject?.trim() || !(draft.textBody?.trim() || draft.htmlBody?.trim())) return output({ error: "Draft needs a subject and a message" }, true);
				attachments = await loadMessageAttachmentContents(env, draft.id);
			} else {
				const [mailbox] = await db.select({ localPart: mailboxes.localPart, hostname: domains.hostname }).from(mailboxes).innerJoin(domains, eq(mailboxes.domainId, domains.id)).where(eq(mailboxes.id, args.mailboxId)).limit(1);
				if (!mailbox) return output({ error: "Mailbox not found" }, true);
				from = (await getAuthorizedSenderAddress(env, { userId, mailboxId: args.mailboxId, from: `${mailbox.localPart}@${mailbox.hostname}` })).fromAddr;
			}
			if (!to.trim()) return output({ error: "Pass to, or a draftId with recipients" }, true);
			const sendAt = args.sendAt ? new Date(args.sendAt) : null;
			if (sendAt && Number.isNaN(sendAt.getTime())) return output({ error: "sendAt must be an ISO 8601 time" }, true);
			const stepOverrides = Object.fromEntries(Object.entries(args.stepOverrides ?? {}).map(([key, value]) => [Number(key), value.body ? { ...value, body: formatAgentDraftBody(value.body).text } : value]));
			const enrollment = await startEnrollment(env, userId, {
				sequenceId: args.sequenceId, mailboxId: args.mailboxId, from, to, cc,
				variables: args.variables, timeZone: args.timeZone, stepOverrides, opening, attachments,
				scheduledAt: sendAt,
			});
			if (args.draftId) await db.update(messages).set({ status: "trash", trashedAt: new Date() }).where(and(eq(messages.id, args.draftId), eq(messages.status, "draft")));
			return output(enrollment);
		} catch (error) { return fail(error, "Could not start sequence"); }
	});
}
