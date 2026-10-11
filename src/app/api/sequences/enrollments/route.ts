import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { requireSessionUser } from "@/lib/api/auth";
import { findEnrollmentForMessage, listEnrollments } from "@/lib/sequences/service";
import type { EnrollmentStatus } from "@/lib/sequences/types";

const statuses: EnrollmentStatus[] = ["active", "replied", "stopped", "finished", "failed"];

/** ?messageId= finds the enrollment a message or thread belongs to; otherwise lists. */
export async function GET(request: Request) {
	const env = getEnv();
	const { user, error: unauthorized } = await requireSessionUser(env, request);
	if (!user) return unauthorized;
	const url = new URL(request.url);
	const messageId = url.searchParams.get("messageId");
	if (messageId) return NextResponse.json({ enrollment: await findEnrollmentForMessage(env, user.id, messageId) });
	const status = url.searchParams.get("status") as EnrollmentStatus | null;
	return NextResponse.json({
		enrollments: await listEnrollments(env, user.id, {
			sequenceId: url.searchParams.get("sequenceId") ?? undefined,
			status: status && statuses.includes(status) ? status : undefined,
			limit: Number(url.searchParams.get("limit")) || 50,
		}),
	});
}
