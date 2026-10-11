"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ListOrdered } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { formatScheduledSendTime } from "@/components/messages/scheduled-send-utils";
import { authFetch } from "@/lib/auth/client";
import { getEmailAddress, getEmailDisplayName, getFirstEmailAddressEntry } from "@/lib/email/address";
import type { EnrollmentView, SequenceStep } from "@/lib/sequences/types";
import { StepDialog } from "./step-editor";

function firstName(to: string): string {
	const entry = getFirstEmailAddressEntry(to);
	const name = getEmailDisplayName(entry);
	return name && !name.includes("@") ? name.split(/\s+/)[0] : getEmailAddress(entry);
}

const actionClass = "shrink-0 rounded-full px-2.5 py-1 font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50";

/** Above a message in a sequence, styled like Gmail's scheduled-send bar: what goes out next, with Edit / Skip / Stop. */
export function SequenceThreadBanner({ messageId }: { messageId: string }) {
	const { t } = useLanguage();
	const [enrollment, setEnrollment] = useState<EnrollmentView | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState(false);

	const load = useCallback(async () => {
		const response = await authFetch(`/api/sequences/enrollments?messageId=${encodeURIComponent(messageId)}`);
		if (!response.ok) return;
		setEnrollment((await response.json() as { enrollment: EnrollmentView | null }).enrollment);
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
			setEditing(false);
			window.dispatchEvent(new Event("mailflare:messages-changed"));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t("sequences.actionFailed"));
			void load();
		} finally {
			setBusy(false);
		}
	}

	if (!enrollment) return null;
	const post = (body: object) => () => authFetch(`/api/sequences/enrollments/${enrollment.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
	const who = firstName(enrollment.to);
	const next = enrollment.nextStep !== null ? enrollment.steps[enrollment.nextStep] : null;
	const name = <Link href={`/sequences/${enrollment.sequenceId}`} className="font-medium text-neutral-900 hover:underline">{enrollment.sequenceName}</Link>;
	let line: React.ReactNode;
	if (next?.state === "scheduled" && enrollment.nextSendAt) {
		const when = formatScheduledSendTime(enrollment.nextSendAt, t);
		line = <>{name} · {next.position === 0 ? t("sequences.openingSends", { when }) : t("sequences.followUpSends", { number: next.position, when })}{next.position > 0 && next.condition === "no_reply" && <> {t("sequences.unlessReplies", { who })}</>}</>;
	} else if (next?.state === "paused") {
		line = <>{name} · {t("sequences.followUpInDrafts", { number: next.position })}</>;
	} else if (enrollment.status === "replied") {
		line = <>{name} · {t("sequences.stoppedReplied", { who: enrollment.repliedFrom ? firstName(enrollment.repliedFrom) : who })}</>;
	} else if (enrollment.status === "finished") {
		line = <>{name} · {t("sequences.allSent")}</>;
	} else if (enrollment.status === "stopped" || enrollment.status === "failed") {
		line = <>{name} · {t("sequences.stopped")}</>;
	} else {
		return null;
	}
	const editable = next?.state === "scheduled" && next.position > 0 ? next : null;
	const editableStep: SequenceStep | null = editable ? { kind: editable.kind, delayDays: editable.delayDays, sendTime: editable.sendTime, condition: editable.condition, subject: editable.subject, body: editable.body } : null;
	return (
		<div className="mb-2 rounded-lg bg-neutral-100 px-4 py-2.5 text-sm text-neutral-600 sm:mx-6">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<ListOrdered className="h-5 w-5 shrink-0 text-neutral-500" aria-hidden />
				<span className="min-w-0 flex-1 basis-[calc(100%-2rem)] leading-5 sm:basis-auto">{line}</span>
				{next?.state === "scheduled" && (
					<span className="-ml-2.5 flex items-center pl-8 sm:-mr-2 sm:ml-0 sm:pl-0">
						{editable && <button type="button" disabled={busy} onClick={() => setEditing(true)} className={actionClass}>{t("sequences.edit")}</button>}
						{editable && <button type="button" disabled={busy} onClick={() => void act(post({ action: "skip" }))} className={actionClass}>{t("sequences.skip")}</button>}
						<button type="button" disabled={busy} onClick={() => void act(post({ action: "stop" }))} className={actionClass}>{t("sequences.stop")}</button>
					</span>
				)}
			</div>
			{error && !editing && <p role="alert" className="mt-1 pl-8 text-red-600">{error}</p>}
			{editable && (
				<StepDialog
					open={editing}
					onOpenChange={setEditing}
					title={t("sequences.followUpTitle", { number: editable.position })}
					subtitle={`${enrollment.sequenceName} · ${who} · ${t("sequences.thisPersonOnly")}`}
					step={editableStep}
					position={editable.position}
					fields={Object.keys(enrollment.variables)}
					busy={busy}
					error={error}
					onSave={(step) => void act(() => authFetch(`/api/sequences/enrollments/${enrollment.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: editable.position, ...step }) }))}
				/>
			)}
		</div>
	);
}
