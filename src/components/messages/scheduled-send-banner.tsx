"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { formatScheduledSend } from "@/components/compose/schedule-send-utils";
import { authFetch } from "@/lib/auth/client";
import { ScheduledSendIcon } from "@/components/icons/scheduled-send-icon";

/** Shown on a queued outbound message: when it will go out, and a Gmail-style "Cancel send"
 * that turns it back into a draft. */
export function ScheduledSendBanner({ messageId }: { messageId: string }) {
	const { t } = useLanguage();
	const router = useRouter();
	const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		authFetch(`/api/messages/${messageId}/schedule`)
			.then((response) => response.ok ? response.json() as Promise<{ scheduledAt: string }> : null)
			.then((data) => { if (!cancelled && data) setScheduledAt(new Date(data.scheduledAt)); })
			.catch(() => {});
		return () => { cancelled = true; };
	}, [messageId]);

	if (!scheduledAt) return null;

	async function cancelSend() {
		setBusy(true);
		setError(null);
		try {
			const response = await authFetch(`/api/messages/${messageId}/schedule`, { method: "DELETE" });
			const data = await response.json().catch(() => ({})) as { error?: string; draftId?: string };
			if (!response.ok) throw new Error(data.error || t("scheduledSend.cancelFailed"));
			window.dispatchEvent(new Event("mailflare:messages-changed"));
			router.push(`/drafts/${data.draftId ?? messageId}`);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t("scheduledSend.cancelFailed"));
			setBusy(false);
		}
	}

	return (
		<div className="mx-3 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-neutral-800 sm:mx-6 sm:ml-16">
			<ScheduledSendIcon className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
			<span className="min-w-0 flex-1">{t("scheduledSend.banner", { time: formatScheduledSend(scheduledAt) })}</span>
			<button
				type="button"
				onClick={cancelSend}
				disabled={busy}
				className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:opacity-60"
			>
				{busy ? t("scheduledSend.cancelling") : t("scheduledSend.cancel")}
			</button>
			{error && <p className="basis-full text-xs text-red-600">{error}</p>}
		</div>
	);
}
