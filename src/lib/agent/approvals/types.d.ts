export type AgentSendSnapshot = {
	from: string;
	to: string;
	cc: string | null;
	bcc: string | null;
	subject: string;
	text: string | null;
	html: string | null;
	inReplyTo: string | null;
	references: string | null;
	threadId: string | null;
	mailboxId: string;
	scheduledAt: string | null;
	/** Present only when the scheduled send has a condition, e.g. "no_reply". */
	condition?: string;
	attachments: { id: string; filename: string; size: number; digest: string }[];
};
