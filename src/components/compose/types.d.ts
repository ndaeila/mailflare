export type ComposeDraft = {
	id: string;
	mailboxId: string | null;
	fromAddr: string;
	toAddr: string;
	ccAddr?: string | null;
	bccAddr?: string | null;
	subject: string | null;
	textBody: string | null;
	htmlBody: string | null;
	inReplyTo?: string | null;
	references?: string | null;
	threadId?: string | null;
	/** Files already stored on the draft, e.g. carried over by Forward. */
	attachments?: ComposeStoredAttachment[];
	agent?: { revision: number; origin: "chat" | "auto" | "mcp"; scheduledAt: string | null; sendCondition?: string | null } | null;
	/** Set when this draft was a scheduled send that was skipped because someone replied. */
	skippedSend?: { reason: "reply"; from: string; at: string } | null;
};

export type ComposeStoredAttachment = {
	id: string;
	filename: string;
	size: number;
	type: string;
	disposition: "attachment" | "inline";
};

/** Headers a reply draft carries so the sent message joins its conversation. */
export type ComposeThreading = {
	inReplyTo: string | null;
	references: string | null;
	threadId: string | null;
};

export type DraftResponse = {
	draft?: ComposeDraft;
	error?: string;
};

export type ComposeAttachment = {
	id: string;
	file: File;
};
