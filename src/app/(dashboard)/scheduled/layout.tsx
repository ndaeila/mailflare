"use client";

import { MessageSplitLayout } from "@/components/messages/message-split-layout";
import { scheduledFolderConfig } from "@/components/messages/message-folder-configs";

export default function ScheduledLayout({ children }: { children: React.ReactNode }) {
	return <MessageSplitLayout config={scheduledFolderConfig}>{children}</MessageSplitLayout>;
}
