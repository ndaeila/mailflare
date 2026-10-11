import { skipConditionalSendsForReply } from "./send-conditions";

type InboundReply = { mailboxId: string; threadId: string | null; fromAddr: string; receivedAt: Date };

/** Everything that should react when someone replies: conditional scheduled sends, then sequences. */
export async function handleInboundReply(env: CloudflareEnv, reply: InboundReply): Promise<void> {
	const skipped = await skipConditionalSendsForReply(env, reply);
	const { handleSequenceReply } = await import("@/lib/sequences/service");
	await handleSequenceReply(env, reply, skipped);
}
