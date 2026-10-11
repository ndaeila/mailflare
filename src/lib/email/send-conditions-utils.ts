import { getEmailAddressList, splitEmailAddressList } from "@/lib/email/address";
import type { SendCondition, SendConditionType } from "./send-conditions-types";

export const SEND_CONDITION_TYPES: SendConditionType[] = ["no_reply"];

export function isSendConditionType(value: unknown): value is SendConditionType {
	return typeof value === "string" && (SEND_CONDITION_TYPES as string[]).includes(value);
}

/** Lower-cased bare addresses from header-style recipient lists. */
export function recipientAddresses(...lists: (string | string[] | null | undefined)[]): string[] {
	const out = new Set<string>();
	for (const list of lists) {
		const entries = Array.isArray(list) ? list : splitEmailAddressList(list ?? "");
		for (const entry of entries) for (const address of getEmailAddressList(entry)) out.add(address.toLowerCase());
	}
	return [...out];
}

/** "Cancel if they reply": a reply in the thread, or any message from a recipient, stops the send. */
export function buildNoReplyCondition(input: { threadId?: string | null; to?: string | string[]; cc?: string | string[]; since?: Date }): SendCondition {
	return { type: "no_reply", threadId: input.threadId ?? null, addresses: recipientAddresses(input.to, input.cc), since: (input.since ?? new Date()).toISOString() };
}

export function parseSendCondition(value: string | null | undefined): SendCondition | null {
	if (!value) return null;
	try {
		const parsed = JSON.parse(value) as SendCondition;
		return parsed?.type === "no_reply" ? parsed : null;
	} catch {
		return null;
	}
}

export function conditionMatchesReply(condition: SendCondition, reply: { threadId: string | null; fromAddr: string; receivedAt: Date }): boolean {
	if (reply.receivedAt.getTime() < new Date(condition.since).getTime()) return false;
	if (condition.threadId && reply.threadId === condition.threadId) return true;
	const from = recipientAddresses(reply.fromAddr);
	return from.some((address) => condition.addresses.includes(address));
}
