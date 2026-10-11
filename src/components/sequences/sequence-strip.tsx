"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ListOrdered, Mail, Reply, X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SequenceStep } from "@/lib/sequences/types";
import { stepDays } from "@/lib/sequences/utils";
import { mergeChipClass, TemplateText } from "./template-text";
import { fieldLabel, previewText } from "./sequence-ui-utils";

/**
 * Docked above the composer toolbar, where Gmail shows attachments. The email being written
 * stays in the editor as step 1; this lists what follows and the fields still to fill.
 */
export function SequenceStrip({ name, steps, variables, fields, values, onValueChange, openingNote, onOpeningAction, openingActionLabel, onEditStep, onRemove, expanded, onExpandedChange }: {
	name: string;
	steps: SequenceStep[];
	variables: Record<string, string>;
	fields: string[];
	values: Record<string, string>;
	onValueChange: (name: string, value: string) => void;
	/** e.g. "Your draft" or "Template opening" */
	openingNote: string;
	onOpeningAction?: () => void;
	openingActionLabel?: string;
	onEditStep: (position: number) => void;
	onRemove: () => void;
	expanded: boolean;
	onExpandedChange: (expanded: boolean) => void;
}) {
	const { t } = useLanguage();
	const days = stepDays(steps);
	const unfilled = fields.filter((field) => !values[field]?.trim());
	const [focusField, setFocusField] = useState<string | null>(null);
	return (
		<div className="mx-3 mb-2 overflow-hidden rounded-xl border border-neutral-200 bg-white">
			<div className="flex min-h-11 items-center gap-2 pl-3 pr-1.5">
				<ListOrdered className="h-4 w-4 shrink-0 text-blue-700" aria-hidden />
				<button type="button" onClick={() => onExpandedChange(!expanded)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-sm outline-none">
					<span className="shrink-0 font-medium text-neutral-900">{name}</span>
					<span className="min-w-0 truncate text-neutral-500">{t("sequences.followUps", { count: steps.length - 1 })}<span className="max-sm:hidden"> · {steps.slice(1).some((step) => step.condition === "no_reply") ? t("sequences.stopsIfReply") : t("sequences.always")}</span></span>
					{unfilled.length > 0 && !expanded && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">{t("sequences.fieldsToFill", { count: unfilled.length })}</span>}
					<ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-neutral-500 transition-transform", expanded && "rotate-180")} aria-hidden />
				</button>
				<Tooltip label={t("sequences.remove")}>
					<button type="button" onClick={onRemove} aria-label={t("sequences.remove")} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><X className="h-4 w-4" /></button>
				</Tooltip>
			</div>
			{expanded && (
				<div className="max-h-64 overflow-y-auto border-t border-neutral-100 pb-1">
					<ol className="relative">
						<li className="flex items-center gap-3 px-3 py-2 text-sm">
							<span className="relative flex w-3 shrink-0 justify-center self-stretch">
								<span className="absolute bottom-0 top-1/2 w-px bg-neutral-300" aria-hidden />
								<span className="relative mt-[7px] h-2.5 w-2.5 rounded-full bg-blue-600" aria-hidden />
							</span>
							<span className="w-14 shrink-0 text-neutral-500">{t("sequences.now")}</span>
							<span className="min-w-0 flex-1 truncate text-neutral-900">{t("sequences.thisEmail")}<span className={cn("text-neutral-500", onOpeningAction && "max-sm:hidden")}> · {openingNote}</span></span>
							{onOpeningAction && openingActionLabel && <button type="button" onClick={onOpeningAction} className="shrink-0 rounded-full px-2 py-1 text-sm font-medium text-blue-700 hover:bg-blue-50">{openingActionLabel}</button>}
						</li>
						{steps.slice(1).map((step, offset) => {
							const position = offset + 1;
							const last = position === steps.length - 1;
							const KindIcon = step.kind === "new" ? Mail : Reply;
							return (
								<li key={position}>
									<button type="button" onClick={() => onEditStep(position)} className="group flex w-full items-center gap-3 px-3 py-2 text-left text-sm outline-none hover:bg-[#f2f6fc] focus-visible:bg-[#f2f6fc] dark:hover:bg-neutral-100 dark:focus-visible:bg-neutral-100">
										<span className="relative flex w-3 shrink-0 justify-center self-stretch">
											<span className={cn("absolute top-0 w-px bg-neutral-300", last ? "h-1/2" : "bottom-0")} aria-hidden />
											<span className="relative mt-[7px] h-2.5 w-2.5 rounded-full border-2 border-neutral-400 bg-white" aria-hidden />
										</span>
										<span className="w-14 shrink-0 text-neutral-500">{t("sequences.day", { day: days[position] })}</span>
										<span className="flex min-w-0 flex-1 items-center gap-1.5">
											<KindIcon className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-label={step.kind === "new" ? t("sequences.kind.new") : t("sequences.kind.reply")} />
											<span className="min-w-0 truncate text-neutral-800">
												{step.kind === "new" && <><TemplateText text={step.subject} variables={variables} className="font-medium text-neutral-900" /> · </>}
												<TemplateText text={previewText(step.body, 120)} variables={variables} />
											</span>
										</span>
										{step.condition === "always" && <span className="shrink-0 text-xs text-neutral-500">{t("sequences.always")}</span>}
										<ChevronRight className="h-4 w-4 shrink-0 text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100" aria-hidden />
									</button>
								</li>
							);
						})}
					</ol>
					{fields.length > 0 && (
						<div className="mx-3 mt-1 space-y-1.5 border-t border-neutral-100 pt-2">
							{fields.map((field) => (
								<label key={field} className={cn("flex items-center gap-2 rounded-lg px-1 py-0.5", focusField === field && "bg-neutral-50")}>
									<span className={cn(mergeChipClass, "shrink-0 text-xs")}>{fieldLabel(field, t)}</span>
									<input
										value={values[field] ?? ""}
										onFocus={() => setFocusField(field)}
										onBlur={() => setFocusField(null)}
										onChange={(event) => onValueChange(field, event.target.value)}
										placeholder={t("sequences.fillIn")}
										className="h-8 min-w-0 flex-1 border-b border-neutral-200 bg-transparent px-1 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-blue-600"
									/>
								</label>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
