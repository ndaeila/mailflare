import { NextResponse } from "next/server";

/** Turns a thrown service error into a 4xx response with its message. */
export function sequenceError(error: unknown) {
	const message = error instanceof Error ? error.message : "Request failed";
	const status = /not found/i.test(message) ? 404 : 400;
	return NextResponse.json({ error: message }, { status });
}

export type IdRouteParams = { params: Promise<{ id: string }> };
