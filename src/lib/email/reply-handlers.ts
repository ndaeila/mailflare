import { skipConditionalSendsForReply } from "./send-conditions";

type InboundReply = { mailboxId: string; threadId: string | null; fromAddr: string; receivedAt: Date };

/** Everything that should react when someone replies: conditional scheduled sends today. */
export async function handleInboundReply(env: CloudflareEnv, reply: InboundReply): Promise<void> {
	await skipConditionalSendsForReply(env, reply);
}
