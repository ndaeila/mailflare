"use client";

import { useCallback, useEffect, useState } from "react";
import { ListOrdered } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { formatScheduledSendTime } from "@/components/messages/scheduled-send-utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { authFetch } from "@/lib/auth/client";
import { getEmailAddress, getEmailDisplayName, getFirstEmailAddressEntry } from "@/lib/email/address";
import type { EnrollmentView, SequenceStep } from "@/lib/sequences/types";
import { StepEditorPanel } from "./step-editor";

function firstName(to: string): string {
	const entry = getFirstEmailAddressEntry(to);
	const name = getEmailDisplayName(entry);
	return name && !name.includes("@") ? name.split(/\s+/)[0] : getEmailAddress(entry);
}

/** Above a message that belongs to a sequence: what goes out next, with Edit / Skip / Stop. */
export function SequenceThreadBanner({ messageId }: { messageId: string }) {
	const { t } = useLanguage();
	const [enrollment, setEnrollment] = useState<EnrollmentView | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState<{ position: number; step: SequenceStep } | null>(null);

	const load = useCallback(async () => {
		const response = await authFetch(`/api/sequences/enrollments?messageId=${encodeURIComponent(messageId)}`);
		if (!response.ok) return;
		const data = await response.json() as { enrollment: EnrollmentView | null };
		setEnrollment(data.enrollment);
	}, [messageId]);

	useEffect(() => {
		let cancelled = false;
		authFetch(`/api/sequences/enrollments?messageId=${encodeURIComponent(messageId)}`)
			.then(async (response) => (response.ok ? (await response.json() as { enrollment: EnrollmentView | null }).enrollment : null))
			.then((value) => { if (!cancelled) setEnrollment(value); })
			.catch(() => undefined);
		return () => { cancelled = true; };
	}, [messageId]);

	async function act(request: () => Promise<Response>) {
		setBusy(true);
		setError(null);
		try {
			const response = await request();
			const data = await response.json() as { enrollment?: EnrollmentView; error?: string };
			if (!response.ok || !data.enrollment) throw new Error(data.error || t("sequences.actionFailed"));
			setEnrollment(data.enrollment);
			setEditing(null);
			window.dispatchEvent(new Event("mailflare:messages-changed"));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t("sequences.actionFailed"));
			void load();
		} finally {
			setBusy(false);
		}
	}

	if (!enrollment) return null;
	const total = enrollment.steps.length;
	const who = firstName(enrollment.to);
	const next = enrollment.nextStep !== null ? enrollment.steps[enrollment.nextStep] : null;
	let line: React.ReactNode;
	if (next && next.state === "scheduled" && enrollment.nextSendAt) {
		line = <>{t("sequences.bannerNext", { name: enrollment.sequenceName, step: next.position + 1, total, when: formatScheduledSendTime(enrollment.nextSendAt, t) })}{next.condition === "no_reply" && <> {t("sequences.unlessReplies", { who })}</>}</>;
	} else if (next && next.state === "paused") {
		line = t("sequences.bannerPaused", { name: enrollment.sequenceName, step: next.position + 1 });
	} else if (enrollment.status === "replied") {
		line = t("sequences.bannerReplied", { name: enrollment.sequenceName, who: enrollment.repliedFrom ? firstName(enrollment.repliedFrom) : who });
	} else if (enrollment.status === "finished") {
		line = t("sequences.bannerFinished", { name: enrollment.sequenceName });
	} else if (enrollment.status === "stopped" || enrollment.status === "failed") {
		line = t("sequences.bannerStopped", { name: enrollment.sequenceName });
	} else {
		return null;
	}
	const canAct = !!next && next.state === "scheduled";
	return (
		<div className="mb-2 rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700 sm:mx-6">
			<div className="flex items-start gap-3">
				<ListOrdered className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" aria-hidden />
				<span className="min-w-0 flex-1 leading-5">{line}</span>
			</div>
			{error && <p role="alert" className="mt-2 pl-8 text-red-600">{error}</p>}
			{canAct && next && (
				<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-8">
					{next.position > 0 && <button type="button" disabled={busy} onClick={() => setEditing({ position: next.position, step: { kind: next.kind, delayDays: next.delayDays, sendTime: next.sendTime, condition: next.condition, subject: next.subject, body: next.body } })} className="font-medium text-blue-600 hover:underline disabled:opacity-50">{t("sequences.editNext")}</button>}
					{next.position > 0 && <button type="button" disabled={busy} onClick={() => void act(() => authFetch(`/api/sequences/enrollments/${enrollment.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "skip" }) }))} className="font-medium text-blue-600 hover:underline disabled:opacity-50">{t("sequences.skipStep")}</button>}
					<button type="button" disabled={busy} onClick={() => void act(() => authFetch(`/api/sequences/enrollments/${enrollment.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stop" }) }))} className="font-medium text-red-600 hover:underline disabled:opacity-50">{t("sequences.stop")}</button>
				</div>
			)}
			<Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
				<DialogContent className="h-[min(720px,90dvh)] w-[min(480px,calc(100vw-16px))] overflow-hidden p-0" closeClassName="hidden" onOpenAutoFocus={(event) => event.preventDefault()}>
					<DialogTitle className="sr-only">{t("sequences.editNext")}</DialogTitle>
					{editing && (
						<StepEditorPanel
							title={t("sequences.stepTitle", { name: enrollment.sequenceName, step: editing.position + 1 })}
							step={editing.step}
							position={editing.position}
							busy={busy}
							error={error}
							onChange={(step) => setEditing({ position: editing.position, step })}
							onBack={() => setEditing(null)}
							onDone={() => void act(() => authFetch(`/api/sequences/enrollments/${enrollment.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: editing.position, ...editing.step }) }))}
						/>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
