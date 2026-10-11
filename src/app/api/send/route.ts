import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { requireUser } from "@/lib/auth/cookies";
import { sendEmailSchema } from "@/lib/validators";
import { sendEmail } from "@/lib/email/send";
import { parseSendRequest } from "./utils";
import { RequestBodyTooLargeError } from "@/lib/http/errors";
import { getSendErrorStatus } from "./error-utils";
import { getDb } from "@/db";
import { agentDraftMetadata, messages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadMessageAttachmentContents } from "@/lib/email/attachments";
import { userOwnsDraft } from "@/app/api/drafts/utils";
import { joinEmailAddressList } from "@/lib/email/address";
import { htmlToReadableText } from "@/lib/email/reply-content-utils";
import { findEnrollmentByPendingDraft, getSequence, relinkPendingStep, startEnrollment, updateSequence } from "@/lib/sequences/service";
import type { SequenceStepInput } from "@/lib/sequences/types";

export async function POST(request: Request) {
	const env = getEnv();
	const user = await requireUser(env, request);
	let input;
	try {
		input = await parseSendRequest(request);
	} catch (error) {
		const status = error instanceof RequestBodyTooLargeError ? 413 : 400;
		return NextResponse.json({ error: "Invalid send request" }, { status });
	}
	const { attachments = [], draftId, sequence, ...fields } = input;
	const parsed = sendEmailSchema.omit({ attachments: true }).safeParse(fields);
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
	}

	// Files already stored on the draft (a forwarded message's attachments) ride
	// along with whatever the composer uploaded in this request.
	if (draftId) {
		const db = getDb(env);
		const [draft] = await db.select().from(messages).where(eq(messages.id, draftId)).limit(1);
		if (!userOwnsDraft(draft, user.id)) {
			return NextResponse.json({ error: "Draft not found" }, { status: 404 });
		}
		const [agent] = await db.select({ draftId: agentDraftMetadata.draftId }).from(agentDraftMetadata).where(eq(agentDraftMetadata.draftId, draftId)).limit(1);
		if (agent) return NextResponse.json({ error: "Review and confirm this AI draft before sending" }, { status: 409 });
		attachments.push(...(await loadMessageAttachmentContents(env, draftId)));
	}

	try {
		if (sequence) {
			const data = parsed.data;
			if (sequence.saveOpening && !sequence.useTemplateOpening) {
				const current = await getSequence(env, user.id, sequence.sequenceId);
				const opening = sequence.openingTemplate ?? { subject: data.subject, body: data.text || htmlToReadableText(data.html || "") };
				await updateSequence(env, user.id, sequence.sequenceId, { steps: [{ ...current.steps[0], subject: opening.subject, body: opening.body }, ...current.steps.slice(1)] });
			}
			const enrollment = await startEnrollment(env, user.id, {
				sequenceId: sequence.sequenceId, mailboxId: data.mailboxId, from: data.from,
				to: joinEmailAddressList(data.to), cc: data.cc?.length ? joinEmailAddressList(data.cc) : null,
				variables: sequence.variables, timeZone: sequence.timeZone,
				stepOverrides: Object.fromEntries(Object.entries(sequence.stepOverrides ?? {}).map(([key, value]) => [Number(key), value])) as Record<number, SequenceStepInput>,
				opening: sequence.useTemplateOpening ? null : { subject: data.subject, text: data.text, html: data.html, bcc: data.bcc?.length ? joinEmailAddressList(data.bcc) : null, inReplyTo: data.inReplyTo, references: data.references, threadId: data.threadId },
				attachments, scheduledAt: data.scheduledAt, openingCondition: data.condition ?? null,
				publicOrigin: new URL(request.url).origin,
			});
			return NextResponse.json({ messageId: enrollment.openingMessageId, scheduled: enrollment.sentSteps === 0, enrollmentId: enrollment.id });
		}
		// A sequence step that was cancelled to Drafts by hand keeps its place in the sequence.
		const pendingStep = draftId ? await findEnrollmentByPendingDraft(env, user.id, draftId) : null;
		const result = await sendEmail(env, {
			userId: user.id,
			...parsed.data,
			attachments,
			sequenceStep: pendingStep ?? undefined,
			publicOrigin: new URL(request.url).origin,
		});
		if (pendingStep && result.scheduled) await relinkPendingStep(env, pendingStep.enrollmentId, draftId!, result.messageId);
		return NextResponse.json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Send failed";
		return NextResponse.json({ error: message }, { status: getSendErrorStatus(message) });
	}
}
