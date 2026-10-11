"use client";

import { Clock3, FileText, Pencil } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { formatScheduledSendTime } from "@/components/messages/scheduled-send-utils";
import { cn } from "@/lib/utils";
import type { SequenceStep } from "@/lib/sequences/types";
import { stepDays } from "@/lib/sequences/utils";
import { StepKindChip } from "./sequence-picker-dialog";
import { placeholderChipClass, TemplateText } from "./template-text";
import { previewText } from "./sequence-ui-utils";

const cardClass = "block w-full rounded-xl bg-neutral-100 p-3.5 text-left outline-none transition-colors hover:bg-neutral-200/60 focus-visible:ring-2 focus-visible:ring-blue-500";

function Marker({ index, active, last }: { index: number; active: boolean; last: boolean }) {
	return (
		<div className="relative flex w-8 shrink-0 justify-center">
			{!last && <span className="absolute bottom-[-12px] top-8 w-px bg-neutral-300" aria-hidden />}
			<span className={cn("relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold", active ? "bg-blue-600 text-white" : "border-2 border-neutral-300 bg-white text-neutral-600")}>{index + 1}</span>
		</div>
	);
}

/** The composer's sequence view: step 1 is the draft (or the template opening), then each follow-up. */
export function SequenceTimeline({ steps, opening, draft, variables, fields, values, onValueChange, scheduledAt, onEditDraft, onCompare, onEditTemplate, onEditStep }: {
	steps: SequenceStep[];
	opening: "draft" | "template";
	draft: { subject: string; text: string };
	variables: Record<string, string>;
	/** Fields the sender still has to fill. */
	fields: string[];
	values: Record<string, string>;
	onValueChange: (name: string, value: string) => void;
	scheduledAt: Date | null;
	onEditDraft: () => void;
	onCompare: () => void;
	onEditTemplate: () => void;
	onEditStep: (position: number) => void;
}) {
	const { t } = useLanguage();
	const days = stepDays(steps);
	const sendsLabel = scheduledAt ? t("sequences.sendsAt", { when: formatScheduledSendTime(scheduledAt.toISOString(), t) }) : t("sequences.sendsNow");
	const openingStep = steps[0];
	return (
		<div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4">
			<div className="flex gap-3">
				<Marker index={0} active last={steps.length === 1} />
				<div className="min-w-0 flex-1">
					{opening === "draft" ? (
						<div className={cn(cardClass, "p-0 hover:bg-neutral-100")}>
							<button type="button" onClick={onEditDraft} className="block w-full rounded-t-xl p-3.5 text-left outline-none hover:bg-neutral-200/60 focus-visible:ring-2 focus-visible:ring-blue-500">
								<span className="block text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">{t("sequences.yourDraft")} · {sendsLabel}</span>
								<span className="mt-1 block truncate text-[15px] font-semibold text-neutral-900">{draft.subject || t("compose.subject")}</span>
								<span className="mt-0.5 line-clamp-2 block text-sm text-neutral-600">{previewText(draft.text, 160)}</span>
							</button>
							<div className="mx-3.5 flex items-center gap-2 border-t border-neutral-200 py-2.5 text-xs text-neutral-500">
								<FileText className="h-3.5 w-3.5" aria-hidden />
								<span className="flex-1">{t("sequences.templateNotUsed")}</span>
								<button type="button" onClick={onCompare} className="text-sm font-medium text-blue-600 hover:underline">{t("sequences.compare")}</button>
							</div>
						</div>
					) : (
						<div className={cn(cardClass, "p-0 hover:bg-neutral-100")}>
							<button type="button" onClick={onEditTemplate} className="block w-full rounded-t-xl p-3.5 text-left outline-none hover:bg-neutral-200/60 focus-visible:ring-2 focus-visible:ring-blue-500">
								<span className="block text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">{t("sequences.fromTemplate")} · {sendsLabel}</span>
								<TemplateText text={openingStep.subject} variables={variables} className="mt-1 block text-[15px] font-semibold text-neutral-900" />
								<TemplateText text={previewText(openingStep.body, 160)} variables={variables} className="mt-0.5 line-clamp-2 block text-sm leading-6 text-neutral-600" />
							</button>
							<div className="mx-3.5 flex items-center gap-2 border-t border-neutral-200 py-2.5 text-xs text-neutral-500">
								<Pencil className="h-3.5 w-3.5" aria-hidden />
								<span className="flex-1">{draft.subject || draft.text ? t("sequences.draftNotUsed") : t("sequences.editsThisEmail")}</span>
								{draft.subject || draft.text
									? <button type="button" onClick={onCompare} className="text-sm font-medium text-blue-600 hover:underline">{t("sequences.compare")}</button>
									: <button type="button" onClick={onEditTemplate} className="text-sm font-medium text-blue-600 hover:underline">{t("sequences.edit")}</button>}
							</div>
						</div>
					)}
				</div>
			</div>
			{steps.slice(1).map((step, offset) => {
				const position = offset + 1;
				return (
					<div key={position} className="flex gap-3">
						<Marker index={position} active={false} last={position === steps.length - 1} />
						<button type="button" onClick={() => onEditStep(position)} className={cn(cardClass, "min-w-0 flex-1")}>
							<span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#c25e0a] dark:text-[#fcc9a6]">
								<Clock3 className="h-3.5 w-3.5" aria-hidden />
								{t("sequences.day", { day: days[position] })} · {step.condition === "no_reply" ? t("sequences.ifNoReply") : t("sequences.always")}
							</span>
							<span className="mt-1.5 block"><StepKindChip kind={step.kind} /></span>
							{step.kind === "new" && <TemplateText text={step.subject} variables={variables} className="mt-1.5 block text-[15px] font-semibold text-neutral-900" />}
							<TemplateText text={previewText(step.body, 150)} variables={variables} className="mt-1 line-clamp-2 block text-sm leading-6 text-neutral-600" />
						</button>
					</div>
				);
			})}
			{fields.length > 0 && (
				<div className="ml-11 space-y-2 rounded-xl border border-dashed border-neutral-300 p-3">
					{fields.some((name) => !values[name]?.trim()) && (
						<p className="flex items-center gap-2 text-sm text-neutral-600">
							<Pencil className="h-3.5 w-3.5" aria-hidden />
							{t("sequences.fieldsToFill", { count: fields.filter((name) => !values[name]?.trim()).length })}
						</p>
					)}
					{fields.map((name) => (
						<label key={name} className="flex items-center gap-2">
							<span className={cn(placeholderChipClass, "shrink-0 text-sm")}>{name}</span>
							<input value={values[name] ?? ""} onChange={(event) => onValueChange(name, event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900 outline-none focus:border-blue-500" />
						</label>
					))}
				</div>
			)}
		</div>
	);
}
