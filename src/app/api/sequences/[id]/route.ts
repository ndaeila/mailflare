import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { requireSessionUser } from "@/lib/api/auth";
import { deleteSequence, getSequence, updateSequence } from "@/lib/sequences/service";
import { sequenceError, type IdRouteParams } from "../utils";

export async function GET(request: Request, { params }: IdRouteParams) {
	const env = getEnv();
	const { user, error: unauthorized } = await requireSessionUser(env, request);
	if (!user) return unauthorized;
	try { return NextResponse.json({ sequence: await getSequence(env, user.id, (await params).id) }); }
	catch (error) { return sequenceError(error); }
}

export async function PATCH(request: Request, { params }: IdRouteParams) {
	const env = getEnv();
	const { user, error: unauthorized } = await requireSessionUser(env, request);
	if (!user) return unauthorized;
	const body = await request.json().catch(() => null) as { name?: string; steps?: unknown } | null;
	try { return NextResponse.json({ sequence: await updateSequence(env, user.id, (await params).id, { name: body?.name, steps: body?.steps }) }); }
	catch (error) { return sequenceError(error); }
}

export async function DELETE(request: Request, { params }: IdRouteParams) {
	const env = getEnv();
	const { user, error: unauthorized } = await requireSessionUser(env, request);
	if (!user) return unauthorized;
	try { return NextResponse.json(await deleteSequence(env, user.id, (await params).id)); }
	catch (error) { return sequenceError(error); }
}
