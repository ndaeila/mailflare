import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { requireUser } from "@/lib/auth/cookies";
import { editEnrollmentStep, getEnrollment, skipEnrollmentStep, stopEnrollment } from "@/lib/sequences/service";
import type { SequenceStepInput } from "@/lib/sequences/types";
import { sequenceError, type IdRouteParams } from "../../utils";

export async function GET(request: Request, { params }: IdRouteParams) {
	const env = getEnv();
	const user = await requireUser(env, request);
	try { return NextResponse.json({ enrollment: await getEnrollment(env, user.id, (await params).id) }); }
	catch (error) { return sequenceError(error); }
}

/** Edit this person's copy of an upcoming step: { position, kind?, delayDays?, sendTime?, condition?, subject?, body? }. */
export async function PATCH(request: Request, { params }: IdRouteParams) {
	const env = getEnv();
	const user = await requireUser(env, request);
	const body = await request.json().catch(() => null) as (SequenceStepInput & { position?: number }) | null;
	if (!body || typeof body.position !== "number") return NextResponse.json({ error: "position is required" }, { status: 400 });
	const { position, ...edit } = body;
	try { return NextResponse.json({ enrollment: await editEnrollmentStep(env, user.id, (await params).id, position, edit) }); }
	catch (error) { return sequenceError(error); }
}

/** { action: "skip" | "stop" } */
export async function POST(request: Request, { params }: IdRouteParams) {
	const env = getEnv();
	const user = await requireUser(env, request);
	const body = await request.json().catch(() => null) as { action?: string } | null;
	const id = (await params).id;
	try {
		if (body?.action === "skip") return NextResponse.json({ enrollment: await skipEnrollmentStep(env, user.id, id) });
		if (body?.action === "stop") return NextResponse.json({ enrollment: await stopEnrollment(env, user.id, id) });
		return NextResponse.json({ error: "Unknown action" }, { status: 400 });
	} catch (error) { return sequenceError(error); }
}
