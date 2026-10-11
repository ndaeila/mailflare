import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { cancelScheduledSend, getScheduledTimes } from "@/lib/email/scheduled";
import { getMailboxAccessLevel } from "@/lib/mailboxes/access";

async function loadScheduledMessage(request: Request, messageId: string) {
	const env = getEnv();
	const user = await getCurrentUser(env, request);
	if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
	const db = getDb(env);
	const [message] = await db
		.select({ id: messages.id, mailboxId: messages.mailboxId })
		.from(messages)
		.where(and(eq(messages.id, messageId), eq(messages.direction, "outbound"), eq(messages.status, "queued")))
		.limit(1);
	const access = message?.mailboxId ? await getMailboxAccessLevel(db, user, message.mailboxId) : null;
	if (!message || !access?.canRead) return { error: NextResponse.json({ error: "Scheduled message not found" }, { status: 404 }) } as const;
	return { env, message, access } as const;
}

export async function GET(request: Request, { params }: { params: Promise<{ messageId: string }> }) {
	const loaded = await loadScheduledMessage(request, (await params).messageId);
	if ("error" in loaded) return loaded.error;
	const scheduledAt = (await getScheduledTimes(loaded.env, [loaded.message.id])).get(loaded.message.id);
	if (!scheduledAt) return NextResponse.json({ error: "Scheduled message not found" }, { status: 404 });
	return NextResponse.json({ scheduledAt: scheduledAt.toISOString() });
}

/** Cancel the scheduled send; the message becomes a draft again. */
export async function DELETE(request: Request, { params }: { params: Promise<{ messageId: string }> }) {
	const loaded = await loadScheduledMessage(request, (await params).messageId);
	if ("error" in loaded) return loaded.error;
	if (!loaded.access.canSendAs && !loaded.access.canSendOnBehalf) {
		return NextResponse.json({ error: "You can't cancel sends from this mailbox" }, { status: 403 });
	}
	if (!(await cancelScheduledSend(loaded.env, loaded.message.id))) {
		return NextResponse.json({ error: "This message is already sending or was sent" }, { status: 409 });
	}
	return NextResponse.json({ ok: true, draftId: loaded.message.id });
}
