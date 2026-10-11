import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { requireSessionUser } from "@/lib/api/auth";
import { hasValidSessionMutationOrigin } from "@/lib/auth/origin";
import { getEnv } from "@/lib/cloudflare";
import { deleteMessageWithObjects } from "@/lib/email/message-cleanup";
import { buildSnippet } from "@/lib/email/parse";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const env = getEnv();
	const auth = await requireSessionUser(env, request);
	if (auth.error) return auth.error;
	if (!hasValidSessionMutationOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
	const { id } = await params;
	const db = getDb(env);
	const [row] = await db
		.select({ id: messages.id, rawR2Key: messages.rawR2Key })
		.from(messages)
		.where(and(eq(messages.id, id), eq(messages.userId, auth.user.id), eq(messages.status, "template")))
		.limit(1);
	if (!row) return NextResponse.json({ error: "Template not found" }, { status: 404 });
	await deleteMessageWithObjects(env, db, row.id, row.rawR2Key);
	return NextResponse.json({ ok: true });
}

/** Rename or rewrite a template: { title, html, text }. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const env = getEnv();
	const auth = await requireSessionUser(env, request);
	if (auth.error) return auth.error;
	if (!hasValidSessionMutationOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
	const { id } = await params;
	const input = (await request.json().catch(() => null)) as { title?: string; html?: string; text?: string } | null;
	const title = input?.title?.trim().slice(0, 200);
	const html = input?.html ?? "";
	const text = input?.text ?? "";
	if (!title || !(html.trim() || text.trim())) return NextResponse.json({ error: "Enter a title and content." }, { status: 400 });
	const updated = await getDb(env)
		.update(messages)
		.set({ subject: title, htmlBody: html || null, textBody: text || null, snippet: buildSnippet(text || null, html || null) })
		.where(and(eq(messages.id, id), eq(messages.userId, auth.user.id), eq(messages.status, "template")))
		.returning({ id: messages.id });
	if (!updated.length) return NextResponse.json({ error: "Template not found" }, { status: 404 });
	return NextResponse.json({ template: { id, subject: title, htmlBody: html || null, textBody: text || null } });
}
