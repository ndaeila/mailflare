export type SendConditionType = "no_reply";

/** Stored as JSON on outbound_jobs.send_condition. */
export type SendCondition = {
	type: "no_reply";
	/** Thread whose replies cancel the send; null for a new conversation. */
	threadId: string | null;
	/** Lower-cased recipient addresses; a message from any of them also counts as a reply. */
	addresses: string[];
	/** Only replies received after this instant count. */
	since: string;
};

export type SkippedSend = { reason: "reply"; from: string; at: string };
