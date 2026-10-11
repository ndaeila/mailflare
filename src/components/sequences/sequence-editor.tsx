"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { formatScheduledSendTime } from "@/components/messages/scheduled-send-utils";
import { authFetch } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import type { EnrollmentView, SequenceStep, SequenceSummary } from "@/lib/sequences/types";
import { stepDays } from "@/lib/sequences/utils";
import { StepKindChip } from "./sequence-picker-dialog";
import { PlaceholderHint, StepFields } from "./step-editor";

const blankOpening: SequenceStep = { kind: "opening", delayDays: 0, sendTime: null, condition: "always", subject: "", body: "Hi {{first_name}},\n\n" };
const blankFollowUp = (): SequenceStep => ({ kind: "reply", delayDays: 3, sendTime: "09:00", condition: "no_reply", subject: "", body: "Hi {{first_name}}, " });

const statusClass: Record<EnrollmentView["status"], string> = {
	active: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
	replied: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
	finished: "bg-neutral-100 text-neutral-600",
	stopped: "bg-neutral-100 text-neutral-600",
	failed: "bg-red-100 text-red-700",
};

/** Create or edit a sequence template, and see who is in it. */
export function SequenceEditor({ sequenceId }: { sequenceId: string | null }) {
	const { t } = useLanguage();
	const router = useRouter();
	const [name, setName] = useState("");
	const [steps, setSteps] = useState<SequenceStep[]>(sequenceId ? [] : [blankOpening, blankFollowUp()]);
	const [people, setPeople] = useState<EnrollmentView[]>([]);
	const [loaded, setLoaded] = useState(!sequenceId);
	const [saving, setSaving] = useState(false);
	const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);

	useEffect(() => {
		if (!sequenceId) return;
		let cancelled = false;
		Promise.all([
			authFetch(`/api/sequences/${sequenceId}`).then(async (response) => (response.ok ? (await response.json() as { sequence: SequenceSummary }).sequence : null)),
			authFetch(`/api/sequences/enrollments?sequenceId=${encodeURIComponent(sequenceId)}`).then(async (response) => (response.ok ? (await response.json() as { enrollments: EnrollmentView[] }).enrollments : [])),
		]).then(([sequence, enrollments]) => {
			if (cancelled) return;
			if (sequence) { setName(sequence.name); setSteps(sequence.steps); }
			else setNotice({ type: "error", text: t("sequences.loadFailed") });
			setPeople(enrollments);
			setLoaded(true);
		}).catch(() => { if (!cancelled) { setNotice({ type: "error", text: t("sequences.loadFailed") }); setLoaded(true); } });
		return () => { cancelled = true; };
	}, [sequenceId, t]);

	async function save() {
		setSaving(true);
		setNotice(null);
		try {
			const response = await authFetch(sequenceId ? `/api/sequences/${sequenceId}` : "/api/sequences", {
				method: sequenceId ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, steps }),
			});
			const data = await response.json() as { sequence?: SequenceSummary; error?: string };
			if (!response.ok || !data.sequence) throw new Error(data.error || t("sequences.saveFailed"));
			setSteps(data.sequence.steps);
			setNotice({ type: "success", text: t("sequences.saved") });
			if (!sequenceId) router.replace(`/sequences/${data.sequence.id}`);
		} catch (error) {
			setNotice({ type: "error", text: error instanceof Error ? error.message : t("sequences.saveFailed") });
		} finally {
			setSaving(false);
		}
	}

	async function remove() {
		if (!sequenceId) { router.push("/sequences"); return; }
		setSaving(true);
		const response = await authFetch(`/api/sequences/${sequenceId}`, { method: "DELETE" });
		setSaving(false);
		if (response.ok) router.push("/sequences");
		else setNotice({ type: "error", text: t("sequences.saveFailed") });
	}

	const days = stepDays(steps);
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex h-14 shrink-0 items-center gap-2 border-b border-neutral-200 px-2 md:px-4">
				<Link href="/sequences" aria-label={t("sequences.back")} className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100"><ArrowLeft className="h-5 w-5" /></Link>
				<h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-neutral-900">{name || t("sequences.new")}</h1>
				<button type="button" onClick={() => void save()} disabled={saving || !loaded} className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{t("sequences.save")}</button>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto max-w-2xl space-y-4 px-4 py-5 md:px-6">
					{notice && <p role={notice.type === "error" ? "alert" : "status"} className={cn("rounded-lg px-3 py-2 text-sm", notice.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>{notice.text}</p>}
					{loaded && (
						<>
							<div>
								<label htmlFor="sequence-name" className="mb-1.5 block text-xs font-medium text-neutral-500">{t("sequences.name")}</label>
								<input id="sequence-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("sequences.namePlaceholder")} className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[15px] text-neutral-900 outline-none focus:border-blue-500" />
							</div>
							{steps.map((step, index) => (
								<section key={index} className="rounded-2xl bg-neutral-100 p-4">
									<div className="mb-3 flex items-center gap-2">
										<span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold", index === 0 ? "bg-blue-600 text-white" : "border-2 border-neutral-300 bg-white text-neutral-600")}>{index + 1}</span>
										<span className="text-[15px] font-semibold text-neutral-900">{index === 0 ? t("sequences.openingEmail") : t("sequences.day", { day: days[index] })}</span>
										<StepKindChip kind={step.kind} />
										<span className="flex-1" />
										{index > 0 && (
											<button type="button" onClick={() => setSteps((current) => current.filter((_, position) => position !== index))} aria-label={t("sequences.removeStep")} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
										)}
									</div>
									<StepFields step={step} position={index} idPrefix={`seq-step-${index}`} onChange={(next) => setSteps((current) => current.map((value, position) => position === index ? next : value))} />
								</section>
							))}
							{steps.length < 10 && (
								<button type="button" onClick={() => setSteps((current) => [...current, blankFollowUp()])} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50">
									<Plus className="h-4 w-4" aria-hidden />{t("sequences.addStep")}
								</button>
							)}
							<PlaceholderHint />
							{sequenceId && (
								<section className="pt-4">
									<h2 className="mb-2 text-[15px] font-semibold text-neutral-900">{t("sequences.people")}</h2>
									{people.length === 0 ? <p className="text-sm text-neutral-500">{t("sequences.noPeople")}</p> : (
										<ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
											{people.map((person) => (
												<li key={person.id}>
													<Link href={person.nextMessageId && person.steps[person.nextStep ?? 0]?.state === "scheduled" ? `/scheduled/${person.nextMessageId}` : `/sent/${person.steps.find((step) => step.messageId && step.state === "sent")?.messageId ?? person.nextMessageId ?? ""}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50">
														<span className="min-w-0 flex-1">
															<span className="block truncate text-sm font-medium text-neutral-900">{person.to}</span>
															<span className="block text-xs text-neutral-500">
																{`${person.sentSteps}/${person.steps.length}`}
																{person.nextSendAt && <> · {t("sequences.nextSend", { when: formatScheduledSendTime(person.nextSendAt, t) })}</>}
															</span>
														</span>
														<span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusClass[person.status])}>{t(`sequences.status.${person.status}`)}</span>
													</Link>
												</li>
											))}
										</ul>
									)}
								</section>
							)}
							<button type="button" onClick={() => void remove()} disabled={saving} className="mt-2 flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
								<Trash2 className="h-4 w-4" aria-hidden />{t("sequences.delete")}
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
