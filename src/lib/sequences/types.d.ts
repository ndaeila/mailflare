export type SequenceStepKind = "opening" | "reply" | "new";
export type SequenceStepCondition = "no_reply" | "always";

/** One email in a sequence. Bodies are plain text with {{variable}} placeholders. */
export type SequenceStep = {
	/** "opening" is always step 1; later steps reply in the thread or start a new email. */
	kind: SequenceStepKind;
	/** Days after the previous step was sent. Always 0 for the opening. */
	delayDays: number;
	/** Local "HH:MM" in the enrollment's time zone; null sends exactly delayDays later. */
	sendTime: string | null;
	/** "no_reply" holds the step back once anyone replies; "always" sends regardless. */
	condition: SequenceStepCondition;
	/** Ignored for reply steps, which use "Re: " plus the thread's subject. */
	subject: string;
	body: string;
};

export type SequenceStats = { active: number; replied: number; finished: number; stopped: number; total: number };

export type SequenceSummary = {
	id: string;
	name: string;
	steps: SequenceStep[];
	variables: string[];
	stats: SequenceStats;
	createdAt: string;
	updatedAt: string;
};

export type EnrollmentStatus = "active" | "replied" | "stopped" | "finished" | "failed";
export type EnrollmentStepState = "sent" | "scheduled" | "paused" | "upcoming" | "skipped";

export type EnrollmentStepView = SequenceStep & {
	position: number;
	/** Days after the opening, counting the delays of every step before it. */
	day: number;
	state: EnrollmentStepState;
	messageId: string | null;
	scheduledAt: string | null;
};

export type EnrollmentView = {
	id: string;
	sequenceId: string;
	sequenceName: string;
	mailboxId: string;
	from: string;
	to: string;
	cc: string | null;
	status: EnrollmentStatus;
	variables: Record<string, string>;
	timeZone: string;
	sentSteps: number;
	nextStep: number | null;
	nextMessageId: string | null;
	nextSendAt: string | null;
	repliedAt: string | null;
	repliedFrom: string | null;
	createdAt: string;
	steps: EnrollmentStepView[];
};

export type SequenceStepInput = Partial<SequenceStep>;

export type StartEnrollmentInput = {
	sequenceId: string;
	mailboxId: string;
	from: string;
	to: string;
	cc?: string | null;
	variables?: Record<string, string>;
	timeZone?: string | null;
	/** Changes to this person's copy of later steps, keyed by position (1-based after the opening). */
	stepOverrides?: Record<number, SequenceStepInput>;
	/** The email to send as step 1. Omit to use the sequence's template opening. */
	opening?: {
		subject: string;
		text?: string | null;
		html?: string | null;
		bcc?: string | null;
		inReplyTo?: string | null;
		references?: string | null;
		threadId?: string | null;
	} | null;
	attachments?: import("@/lib/email/attachment-types").AttachmentContent[];
	/** Schedule the opening instead of sending it now. */
	scheduledAt?: string | Date | null;
	/** Also hold the scheduled opening back if they write first. */
	openingCondition?: "no_reply" | null;
	publicOrigin?: string;
};
