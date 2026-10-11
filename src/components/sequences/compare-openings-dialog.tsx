"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { SequenceStep } from "@/lib/sequences/types";
import { TemplateText } from "./template-text";
import { previewText } from "./sequence-ui-utils";

/** "First email": choose between the draft and the template's opening. Neither is overwritten. */
export function CompareOpeningsDialog({ open, onOpenChange, draft, template, variables, current, saveOpening, onChoose }: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	draft: { subject: string; text: string };
	template: SequenceStep;
	variables: Record<string, string>;
	current: "draft" | "template";
	saveOpening: boolean;
	onChoose: (choice: "draft" | "template", saveOpening: boolean) => void;
}) {
	const { t } = useLanguage();
	const [choice, setChoice] = useState(current);
	const [save, setSave] = useState(saveOpening);
	const [seenOpen, setSeenOpen] = useState(open);
	if (open !== seenOpen) {
		setSeenOpen(open);
		if (open) { setChoice(current); setSave(saveOpening); }
	}
	const option = (value: "draft" | "template", label: string, body: React.ReactNode) => (
		<button
			type="button"
			role="radio"
			aria-checked={choice === value}
			onClick={() => setChoice(value)}
			className={cn("block w-full rounded-xl border-2 p-3.5 text-left outline-none transition-colors", choice === value ? "border-blue-600 bg-white dark:border-blue-500" : "border-transparent bg-neutral-100 hover:bg-neutral-200/60")}
		>
			<span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
				<span className={cn("flex h-4 w-4 items-center justify-center rounded-full border-2", choice === value ? "border-blue-600" : "border-neutral-400")}>
					{choice === value && <span className="h-2 w-2 rounded-full bg-blue-600" />}
				</span>
				{label}
			</span>
			{body}
		</button>
	);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85dvh] w-[min(440px,calc(100vw-24px))] overflow-y-auto p-4 sm:p-5" onOpenAutoFocus={(event) => event.preventDefault()}>
				<DialogTitle className="pr-8 text-lg">{t("sequences.firstEmail")}</DialogTitle>
				<div role="radiogroup" aria-label={t("sequences.firstEmail")} className="mt-4 space-y-3">
					{option("draft", t("sequences.yourDraft"), <>
						<span className="mt-1.5 block text-[15px] font-semibold text-neutral-900">{draft.subject || t("compose.subject")}</span>
						<span className="mt-0.5 line-clamp-3 block text-sm text-neutral-600">{previewText(draft.text, 200)}</span>
					</>)}
					{option("template", t("sequences.templateOpening"), <>
						<TemplateText text={template.subject} variables={variables} className="mt-1.5 block text-[15px] font-semibold text-neutral-900" />
						<TemplateText text={previewText(template.body, 200)} variables={variables} className="mt-0.5 line-clamp-3 block text-sm leading-6 text-neutral-600" />
					</>)}
				</div>
				{choice === "draft" && (
					<label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl px-1 py-2">
						<FileText className="h-5 w-5 shrink-0 text-neutral-500" aria-hidden />
						<span className="min-w-0 flex-1 text-sm text-neutral-800">{t("sequences.saveDraftAsOpening")}</span>
						<Switch checked={save} onCheckedChange={setSave} aria-label={t("sequences.saveDraftAsOpening")} />
					</label>
				)}
				<div className="mt-4 flex justify-end gap-2">
					<button type="button" onClick={() => onOpenChange(false)} className="rounded-full px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">{t("common.cancel")}</button>
					<button type="button" onClick={() => { onOpenChange(false); onChoose(choice, choice === "draft" && save); }} className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
						{choice === "draft" ? t("sequences.useMyDraft") : t("sequences.useTemplateOpening")}
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
