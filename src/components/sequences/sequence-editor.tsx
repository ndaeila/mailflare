"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Plus, Reply, Trash2, X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { formatScheduledSendTime } from "@/components/messages/scheduled-send-utils";
import { Tooltip } from "@/components/ui/tooltip";
import { authFetch } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import type { EnrollmentView, SequenceStep, SequenceSummary } from "@/lib/sequences/types";
import { sequenceVariables, stepDays } from "@/lib/sequences/utils";
import { EditorWindow } from "@/components/compose/editor-window";
import { SequenceEmailWindow } from "./sequence-email-editor";
import { TemplateText } from "./template-text";
import { previewText, sequenceStats } from "./sequence-ui-utils";

const blankOpening: SequenceStep = { kind: "opening", delayDays: 0, sendTime: null, condition: "always", subject: "", body: "Hi {{first_name}},\n\n" };
const blankFollowUp = (): SequenceStep => ({ kind: "reply", delayDays: 3, sendTime: "09:00", condition: "no_reply", subject: "", body: "Hi {{first_name}}, " });

const statusClass: Record<EnrollmentView["status"], string> = {
	active: "border-transparent bg-blue-100 text-blue-900",
	replied: "border-transparent bg-emerald-100 text-emerald-900",
	finished: "border-neutral-300 text-neutral-600",
	stopped: "border-neutral-300 text-neutral-600",
	failed: "border-transparent bg-red-100 text-red-900",
};

function personLink(person: EnrollmentView): string {
	if (person.nextMessageId && person.nextSendAt) return `/scheduled/${person.nextMessageId}`;
	const sent = [...person.steps].reverse().find((step) => step.state === "sent" && step.messageId);
	return sent?.messageId ? `/sent/${sent.messageId}` : "/sent";
}

/** Create or edit a sequence, Gmail-settings style: rows that open a dialog, then who is in it.
 * `embedded` shows it as a sheet over the composer: it closes instead of navigating, hands a
 * saved sequence back, and leaves out the people list, whose links would leave the page. */
export function SequenceEditor({ sequenceId, embedded }: {
	sequenceId: string | null;
	embedded?: { onClose: () => void; onSaved: (sequence: SequenceSummary) => void; onDeleted?: (id: string) => void };
}) {
	const { t } = useLanguage();
	const router = useRouter();
	const [name, setName] = useState("");
	const [steps, setSteps] = useState<SequenceStep[]>(sequenceId ? [] : [blankOpening, blankFollowUp()]);
	const [summary, setSummary] = useState<SequenceSummary | null>(null);
	const [people, setPeople] = useState<EnrollmentView[]>([]);
	const [loaded, setLoaded] = useState(!sequenceId);
	const [dirty, setDirty] = useState(!sequenceId);
	const [saving, setSaving] = useState(false);
	const [editing, setEditing] = useState<number | null>(null);
	const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);

	useEffect(() => {
		if (!sequenceId) return;
		let cancelled = false;
		Promise.all([
			authFetch(`/api/sequences/${sequenceId}`).then(async (response) => (response.ok ? (await response.json() as { sequence: SequenceSummary }).sequence : null)),
			authFetch(`/api/sequences/enrollments?sequenceId=${encodeURIComponent(sequenceId)}`).then(async (response) => (response.ok ? (await response.json() as { enrollments: EnrollmentView[] }).enrollments : [])),
		]).then(([sequence, enrollments]) => {
			if (cancelled) return;
			if (sequence) { setName(sequence.name); setSteps(sequence.steps); setSummary(sequence); }
			else setNotice({ type: "error", text: t("sequences.loadFailed") });
			setPeople(enrollments);
			setLoaded(true);
		}).catch(() => { if (!cancelled) { setNotice({ type: "error", text: t("sequences.loadFailed") }); setLoaded(true); } });
		return () => { cancelled = true; };
	}, [sequenceId, t]);

	useEffect(() => {
		if (!notice || notice.type !== "success") return;
		const timer = setTimeout(() => setNotice(null), 2500);
		return () => clearTimeout(timer);
	}, [notice]);

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
			setSummary(data.sequence);
			setDirty(false);
			setNotice({ type: "success", text: t("sequences.saved") });
			if (embedded) { embedded.onSaved(data.sequence); return; }
			if (!sequenceId) router.replace(`/sequences/${data.sequence.id}`);
		} catch (error) {
			setNotice({ type: "error", text: error instanceof Error ? error.message : t("sequences.saveFailed") });
		} finally {
			setSaving(false);
		}
	}

	async function remove() {
		if (!sequenceId) { if (embedded) embedded.onClose(); else router.push("/sequences"); return; }
		setSaving(true);
		const response = await authFetch(`/api/sequences/${sequenceId}`, { method: "DELETE" });
		setSaving(false);
		if (response.ok && embedded) { embedded.onDeleted?.(sequenceId); embedded.onClose(); }
		else if (response.ok) router.push("/sequences");
		else setNotice({ type: "error", text: t("sequences.saveFailed") });
	}

	const update = (next: SequenceStep[]) => { setSteps(next); setDirty(true); };
	const days = stepDays(steps);
	const fields = sequenceVariables(steps);
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex h-14 shrink-0 items-center gap-1 border-b border-neutral-200 px-2 md:px-4">
				{embedded ? (
					<Tooltip label={t("common.cancel")}>
						<button type="button" onClick={embedded.onClose} aria-label={t("common.cancel")} className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100 max-md:bg-neutral-100 max-md:text-neutral-700"><X className="h-5 w-5" /></button>
					</Tooltip>
				) : (
					<Tooltip label={t("sequences.back")}>
						<Link href="/sequences" aria-label={t("sequences.back")} className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100"><ArrowLeft className="h-5 w-5" /></Link>
					</Tooltip>
				)}
				<input
					aria-label={t("sequences.name")}
					value={name}
					onChange={(event) => { setName(event.target.value); setDirty(true); }}
					placeholder={t("sequences.untitled")}
					className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-lg text-neutral-900 outline-none placeholder:text-neutral-400 hover:bg-neutral-100 focus:bg-neutral-100"
				/>
				{sequenceId && (
					<Tooltip label={t("sequences.delete")}>
						<button type="button" onClick={() => void remove()} disabled={saving} aria-label={t("sequences.delete")} className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"><Trash2 className="h-5 w-5" /></button>
					</Tooltip>
				)}
				{dirty || !sequenceId
					? <button type="button" onClick={() => void save()} disabled={saving || !loaded} className="ml-1 rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{t("sequences.save")}</button>
					: <span className="ml-1 px-3 text-sm text-neutral-500">{t("sequences.saved")}</span>}
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto max-w-3xl pb-10">
					{notice && <p role={notice.type === "error" ? "alert" : "status"} className={cn("mx-4 mt-4 rounded-lg px-3 py-2 text-sm md:mx-6", notice.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800")}>{notice.text}</p>}
					{loaded && (
						<>
							<p className="px-4.5 pb-1 pt-5 text-xs font-medium text-neutral-500 md:px-6">{summary ? sequenceStats(summary, t) : t("sequences.emails", { count: steps.length })}</p>
							<ol>
								{steps.map((step, index) => {
									const KindIcon = step.kind === "new" ? Mail : Reply;
									const last = index === steps.length - 1;
									return (
										<li key={index} className="group relative">
											<button type="button" onClick={() => setEditing(index)} className="flex w-full gap-4 px-4.5 py-3 text-left outline-none hover:bg-[#f2f6fc] focus-visible:bg-[#f2f6fc] dark:hover:bg-neutral-100 dark:focus-visible:bg-neutral-100 md:px-6">
												<span className="relative flex w-4 shrink-0 justify-center">
													{!last && <span className="absolute -bottom-3 top-5 w-px bg-neutral-300" aria-hidden />}
													{index > 0 && <span className="absolute -top-3 h-4 w-px bg-neutral-300" aria-hidden />}
													<span className={cn("relative mt-1 h-3 w-3 rounded-full", index === 0 ? "bg-blue-600" : "border-2 border-neutral-400 bg-white")} aria-hidden />
												</span>
												<span className="min-w-0 flex-1">
													<span className="flex items-center gap-2 text-xs text-neutral-500">
														{index === 0 ? t("sequences.openingEmail") : <>
															<span>{t("sequences.day", { day: days[index] })}</span>
															<span aria-hidden>·</span>
															<KindIcon className="h-3.5 w-3.5" aria-hidden />
															<span>{step.kind === "new" ? t("sequences.kind.new") : t("sequences.kind.reply")}</span>
															<span aria-hidden>·</span>
															<span>{step.condition === "no_reply" ? t("sequences.ifNoReply") : t("sequences.always")}</span>
															{step.sendTime && <><span aria-hidden>·</span><span>{step.sendTime}</span></>}
														</>}
													</span>
													{step.kind !== "reply" && <span className="mt-0.5 block truncate text-[15px] font-medium text-neutral-900">{step.subject ? <TemplateText text={step.subject} tags /> : <span className="text-neutral-400">{t("sequences.subject")}</span>}</span>}
													<span className="mt-0.5 line-clamp-2 block text-sm leading-6 text-neutral-600">{step.body.trim() ? <TemplateText text={previewText(step.body, 220)} tags /> : <span className="text-neutral-400">{t("sequences.message")}</span>}</span>
												</span>
											</button>
											{index > 0 && (
												<Tooltip label={t("sequences.removeStep")}>
													<button type="button" onClick={() => update(steps.filter((_, position) => position !== index))} aria-label={t("sequences.removeStep")} className="absolute right-3 top-3 rounded-full p-2 text-neutral-500 opacity-0 hover:bg-neutral-200 hover:text-neutral-900 focus:opacity-100 group-hover:opacity-100 max-md:opacity-100 md:right-5"><Trash2 className="h-4 w-4" /></button>
												</Tooltip>
											)}
										</li>
									);
								})}
							</ol>
							{steps.length < 10 && (
								<button type="button" onClick={() => { update([...steps, blankFollowUp()]); setEditing(steps.length); }} className="ml-11 mt-1 flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 md:ml-13">
									<Plus className="h-4 w-4" aria-hidden />{t("sequences.addStep")}
								</button>
							)}
							{sequenceId && !embedded && (
								<section className="mt-8">
									<h2 className="border-b border-neutral-200 px-4.5 pb-2 text-sm font-medium text-neutral-900 md:px-6">{t("sequences.people")}</h2>
									{people.length === 0 ? <p className="px-4.5 py-4 text-sm text-neutral-500 md:px-6">{t("sequences.noPeople")}</p> : (
										<ul>
											{people.map((person) => (
												<li key={person.id}>
													<Link href={personLink(person)} className="flex items-center gap-3 border-b border-neutral-100 px-4.5 py-2.5 hover:bg-[#f2f6fc] dark:hover:bg-neutral-100 md:px-6">
														<span className="min-w-0 flex-1">
															<span className="block truncate text-sm text-neutral-900">{person.to}</span>
															<span className="block truncate text-xs text-neutral-500">
																{t("sequences.sentOf", { sent: person.sentSteps, total: person.steps.length })}
																{person.nextSendAt && <> · {t("sequences.nextSend", { when: formatScheduledSendTime(person.nextSendAt, t) })}</>}
															</span>
														</span>
														<span className={cn("shrink-0 rounded-lg border px-2 py-0.5 text-xs font-medium", statusClass[person.status])}>{t(`sequences.status.${person.status}`)}</span>
													</Link>
												</li>
											))}
										</ul>
									)}
								</section>
							)}
						</>
					)}
				</div>
			</div>
			{editing !== null && steps[editing] && (
				<SequenceEmailWindow
					open
					onOpenChange={(open) => { if (!open) setEditing(null); }}
					title={editing === 0 ? t("sequences.openingEmail") : t("sequences.followUpTitle", { number: editing })}
					subtitle={name || undefined}
					step={steps[editing]}
					position={editing}
					fields={fields}
					threadSubject={steps[0]?.subject}
					onDone={(step) => { update(steps.map((value, position) => position === editing ? step : value)); setEditing(null); }}
				/>
			)}
		</div>
	);
}

/** The sequence editor as a sheet over the composer, like the template editor. */
export function SequenceEditorWindow({ open, onOpenChange, sequenceId, onSaved, onDeleted }: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sequenceId: string | null;
	onSaved: (sequence: SequenceSummary) => void;
	onDeleted?: (id: string) => void;
}) {
	const { t } = useLanguage();
	return (
		<EditorWindow open={open} onOpenChange={onOpenChange} title={sequenceId ? t("sequences.edit") : t("sequences.newSequence")}>
			<SequenceEditor key={sequenceId ?? "new"} sequenceId={sequenceId} embedded={{ onClose: () => onOpenChange(false), onSaved, onDeleted }} />
		</EditorWindow>
	);
}
