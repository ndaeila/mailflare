import type { AttachmentContent } from "@/lib/email/attachment-types";

export interface SendRequestPayload {
	attachments?: AttachmentContent[];
	from: string;
	html?: string;
	mailboxId?: string;
	subject: string;
	text?: string;
	to: string;
	cc?: string;
	bcc?: string;
	inReplyTo?: string;
	references?: string;
	threadId?: string;
	/** Draft whose stored attachments (e.g. forwarded files) should be sent along. */
	draftId?: string;
	scheduledAt?: string;
	/** "no_reply": skip the scheduled send if a recipient replies first. */
	condition?: "no_reply";
	/** Start a sequence with this email as its opening (JSON in multipart requests). */
	sequence?: SendSequenceRequest;
}

export interface SendSequenceRequest {
	sequenceId: string;
	variables?: Record<string, string>;
	/** This person's edits to later steps, keyed by step position. */
	stepOverrides?: Record<string, import("@/lib/sequences/types").SequenceStepInput>;
	/** Send the sequence's template opening (rendered on the server) instead of this email's content. */
	useTemplateOpening?: boolean;
	/** Also make this email the sequence's template opening. */
	saveOpening?: boolean;
	timeZone?: string;
}
