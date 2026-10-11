export type DraftPayload = {
	mailboxId?: string | null;
	from?: string;
	to?: string;
	cc?: string;
	bcc?: string;
	subject?: string;
	text?: string;
	html?: string;
	scheduledAt?: string | null;
	/** AI drafts only: "no_reply" skips the scheduled send if they reply first; null clears it. */
	sendCondition?: "no_reply" | null;
	/** Set when the draft is a reply, so the send carries the threading headers. */
	inReplyTo?: string | null;
	references?: string | null;
	threadId?: string | null;
	/** Copy this message's attachments onto the new draft (forwarding). */
	forwardOfMessageId?: string | null;
};
