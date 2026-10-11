import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { messages, outboundJobs } from "@/db/schema";

/** Message IDs with a pending scheduled delivery, for use in `inArray(messages.id, …)`. */
export function scheduledMessageIds(db: ReturnType<typeof getDb>) {
	return db.select({ id: outboundJobs.messageId }).from(outboundJobs).where(and(eq(outboundJobs.status, "queued"), isNotNull(outboundJobs.scheduledAt)));
}

/** Scheduled delivery times for queued outbound messages, keyed by message ID. */
export async function getScheduledTimes(env: CloudflareEnv, messageIds: string[]): Promise<Map<string, Date>> {
	const result = new Map<string, Date>();
	if (!messageIds.length) return result;
	const rows = await getDb(env)
		.select({ messageId: outboundJobs.messageId, scheduledAt: outboundJobs.scheduledAt })
		.from(outboundJobs)
		.where(and(inArray(outboundJobs.messageId, messageIds), eq(outboundJobs.status, "queued"), isNotNull(outboundJobs.scheduledAt)));
	for (const row of rows) if (row.messageId && row.scheduledAt) result.set(row.messageId, row.scheduledAt);
	return result;
}

/** Stops a scheduled send and turns the message back into an editable draft.
 * The queue consumer skips jobs that are no longer "queued", so the delayed
 * queue message that is still in flight becomes a no-op. */
export async function cancelScheduledSend(env: CloudflareEnv, messageId: string): Promise<boolean> {
	const db = getDb(env);
	const cancelled = await db
		.update(outboundJobs)
		.set({ status: "cancelled", updatedAt: new Date() })
		.where(and(eq(outboundJobs.messageId, messageId), eq(outboundJobs.status, "queued"), isNotNull(outboundJobs.scheduledAt)))
		.returning({ id: outboundJobs.id });
	if (!cancelled.length) return false;
	await db.update(messages).set({ status: "draft" }).where(and(eq(messages.id, messageId), eq(messages.status, "queued")));
	return true;
}
