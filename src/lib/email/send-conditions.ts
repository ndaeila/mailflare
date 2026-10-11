import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { messages, outboundJobs } from "@/db/schema";
import { conditionMatchesReply, parseSendCondition } from "./send-conditions-utils";
import type { SkippedSend } from "./send-conditions-types";

export { SEND_CONDITION_TYPES, buildNoReplyCondition, conditionMatchesReply, isSendConditionType, parseSendCondition, recipientAddresses } from "./send-conditions-utils";

/**
 * Called for each delivered (non-spam, non-automated) inbound message. Scheduled sends
 * that should not go out once this person has replied are claimed (queued -> skipped)
 * and returned to Drafts. The claim uses the same conditional update as delivery, so
 * a send already under way is left alone.
 */
export async function skipConditionalSendsForReply(env: CloudflareEnv, reply: { mailboxId: string; threadId: string | null; fromAddr: string; receivedAt: Date }): Promise<number> {
	const db = getDb(env);
	const candidates = await db
		.select({ jobId: outboundJobs.id, messageId: outboundJobs.messageId, condition: outboundJobs.sendCondition })
		.from(outboundJobs)
		.innerJoin(messages, eq(messages.id, outboundJobs.messageId))
		.where(and(eq(outboundJobs.status, "queued"), isNotNull(outboundJobs.sendCondition), eq(messages.mailboxId, reply.mailboxId)));
	let skipped = 0;
	for (const candidate of candidates) {
		const condition = parseSendCondition(candidate.condition);
		if (!condition || !candidate.messageId || !conditionMatchesReply(condition, reply)) continue;
		const detail: SkippedSend = { reason: "reply", from: reply.fromAddr, at: reply.receivedAt.toISOString() };
		const claimed = await db
			.update(outboundJobs)
			.set({ status: "skipped", error: JSON.stringify(detail), updatedAt: new Date() })
			.where(and(eq(outboundJobs.id, candidate.jobId), eq(outboundJobs.status, "queued")))
			.returning({ id: outboundJobs.id });
		if (!claimed.length) continue;
		await db.update(messages).set({ status: "draft" }).where(and(eq(messages.id, candidate.messageId), eq(messages.status, "queued")));
		skipped += 1;
	}
	return skipped;
}

/** Why the most recent scheduled send of this message did not go out, if it was skipped. */
export async function getSkippedSend(env: CloudflareEnv, messageIds: string[]): Promise<Map<string, SkippedSend>> {
	const result = new Map<string, SkippedSend>();
	if (!messageIds.length) return result;
	const rows = await getDb(env)
		.select({ messageId: outboundJobs.messageId, error: outboundJobs.error })
		.from(outboundJobs)
		.where(and(inArray(outboundJobs.messageId, messageIds), eq(outboundJobs.status, "skipped")))
		.orderBy(desc(outboundJobs.updatedAt));
	for (const row of rows) {
		if (!row.messageId || result.has(row.messageId) || !row.error) continue;
		try { result.set(row.messageId, JSON.parse(row.error) as SkippedSend); } catch { /* ignore malformed */ }
	}
	return result;
}
