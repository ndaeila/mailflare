import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { requireSessionUser } from "@/lib/api/auth";
import { createSequence, listSequences } from "@/lib/sequences/service";
import { sequenceError } from "./utils";

export async function GET(request: Request) {
	const env = getEnv();
	const { user, error: unauthorized } = await requireSessionUser(env, request);
	if (!user) return unauthorized;
	return NextResponse.json({ sequences: await listSequences(env, user.id) });
}

export async function POST(request: Request) {
	const env = getEnv();
	const { user, error: unauthorized } = await requireSessionUser(env, request);
	if (!user) return unauthorized;
	const body = await request.json().catch(() => null) as { name?: string; steps?: unknown } | null;
	try { return NextResponse.json({ sequence: await createSequence(env, user.id, { name: body?.name ?? "", steps: body?.steps }) }, { status: 201 }); }
	catch (error) { return sequenceError(error); }
}
