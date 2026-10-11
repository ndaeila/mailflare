"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Mail, Pencil, Reply } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { authFetch } from "@/lib/auth/client";
import type { SequenceStep, SequenceSummary } from "@/lib/sequences/types";
import { stepDays } from "@/lib/sequences/utils";
import { TemplateText } from "./template-text";
import { sequenceMeta } from "./sequence-ui-utils";

const chipClass = "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

export function StepKindChip({ kind }: { kind: SequenceStep["kind"] }) {
	const { t } = useLanguage();
	if (kind === "opening") return <span className={`${chipClass} bg-blue-600/15 text-blue-700 dark:text-blue-300`}><FileText className="h-3 w-3" aria-hidden />{t("sequences.kind.opening")}</span>;
	if (kind === "reply") return <span className={`${chipClass} bg-neutral-100 text-neutral-600`}><Reply className="h-3 w-3" aria-hidden />{t("sequences.kind.reply")}</span>;
	return <span className={`${chipClass} bg-neutral-100 text-neutral-600`}><Mail className="h-3 w-3" aria-hidden />{t("sequences.kind.new")}</span>;
}

/** "Use a sequence": pick a saved sequence for the email being written. The draft is not touched. */
export function SequencePickerDialog({ open, onOpenChange, onPick, hasDraft }: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onPick: (sequence: SequenceSummary) => void;
	hasDraft: boolean;
}) {
	const { t } = useLanguage();
	const [sequences, setSequences] = useState<SequenceSummary[] | null>(null);
	const [failed, setFailed] = useState(false);
	const [seenOpen, setSeenOpen] = useState(open);
	if (open !== seenOpen) {
		setSeenOpen(open);
		if (open) setFailed(false);
	}

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		authFetch("/api/sequences")
			.then(async (response) => {
				if (!response.ok) throw new Error("load");
				const data = await response.json() as { sequences: SequenceSummary[] };
				if (!cancelled) setSequences(data.sequences);
			})
			.catch(() => { if (!cancelled) setFailed(true); });
		return () => { cancelled = true; };
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85dvh] w-[min(440px,calc(100vw-24px))] overflow-y-auto p-4 sm:p-5" onOpenAutoFocus={(event) => event.preventDefault()}>
				<DialogTitle className="pr-8 text-lg">{t("sequences.use")}</DialogTitle>
				<div className="mt-4 space-y-3">
					{failed && <p className="text-sm text-red-600">{t("sequences.loadFailed")}</p>}
					{!failed && sequences === null && <div className="h-28 animate-pulse rounded-xl bg-neutral-100" />}
					{sequences?.length === 0 && (
						<div className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-600">
							<p className="font-medium text-neutral-900">{t("sequences.empty")}</p>
							<p className="mt-1">{t("sequences.emptyHint")}</p>
							<Link href="/sequences/new" onClick={() => onOpenChange(false)} className="mt-3 inline-block font-medium text-blue-600 hover:underline">{t("sequences.create")}</Link>
						</div>
					)}
					{sequences?.map((sequence) => {
						const days = stepDays(sequence.steps);
						return (
							<button
								key={sequence.id}
								type="button"
								onClick={() => { onOpenChange(false); onPick(sequence); }}
								className="block w-full rounded-xl bg-neutral-100 p-3.5 text-left outline-none transition-colors hover:bg-neutral-200/70 focus-visible:ring-2 focus-visible:ring-blue-500"
							>
								<span className="block text-[15px] font-semibold text-neutral-900">{sequence.name}</span>
								<span className="mt-0.5 block text-xs text-neutral-500">{sequenceMeta(sequence.steps, t)}</span>
								<span className="mt-3 block space-y-2">
									{sequence.steps.map((step, index) => (
										<span key={index} className="flex items-start gap-2 text-sm">
											<StepKindChip kind={step.kind} />
											{step.kind === "opening" ? (
												<TemplateText text={step.subject} className="min-w-0 font-medium text-neutral-900" />
											) : (
												<span className="min-w-0 text-xs leading-5 text-neutral-500">
													{t("sequences.day", { day: days[index] })} · {step.condition === "no_reply" ? t("sequences.ifNoReply") : t("sequences.always")}
													{step.kind === "new" && <> · &ldquo;<TemplateText text={step.subject} />&rdquo;</>}
												</span>
											)}
										</span>
									))}
								</span>
							</button>
						);
					})}
					{hasDraft && !!sequences?.length && (
						<p className="flex items-start gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-xs text-neutral-600">
							<Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
							{t("sequences.draftKeptNote")}
						</p>
					)}
					{!!sequences?.length && (
						<Link href="/sequences" onClick={() => onOpenChange(false)} className="block text-center text-sm font-medium text-blue-600 hover:underline">{t("sequences.manage")}</Link>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
