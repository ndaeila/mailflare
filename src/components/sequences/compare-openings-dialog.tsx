"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { SequenceStep } from "@/lib/sequences/types";
import { TemplateText } from "./template-text";
import { previewText } from "./sequence-ui-utils";

/** "First email": keep the draft, or set it aside for the template's opening. Nothing is lost either way. */
export function CompareOpeningsDialog({ open, onOpenChange, draft, template, variables, saveOpening, onChoose }: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	draft: { subject: string; text: string };
	template: SequenceStep;
	variables: Record<string, string>;
	saveOpening: boolean;
	onChoose: (choice: "draft" | "template", saveOpening: boolean) => void;
}) {
	const { t } = useLanguage();
	const [choice, setChoice] = useState<"draft" | "template">("draft");
	const [save, setSave] = useState(saveOpening);
	const [seenOpen, setSeenOpen] = useState(open);
	if (open !== seenOpen) {
		setSeenOpen(open);
		if (open) { setChoice("draft"); setSave(saveOpening); }
	}
	const option = (value: "draft" | "template", label: string, body: React.ReactNode) => (
		<button
			type="button"
			role="radio"
			aria-checked={choice === value}
			onClick={() => setChoice(value)}
			className={cn("flex w-full gap-3 rounded-2xl p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600", choice === value ? "bg-blue-50" : "hover:bg-neutral-100")}
		>
			<span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", choice === value ? "border-blue-600" : "border-neutral-500")}>
				{choice === value && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block text-xs font-medium text-neutral-500">{label}</span>
				{body}
			</span>
		</button>
	);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[calc(100dvh-4rem)] w-[min(480px,calc(100vw-24px))] overflow-y-auto rounded-[28px] p-5 sm:p-6" closeClassName="hidden" onOpenAutoFocus={(event) => event.preventDefault()}>
				<DialogTitle className="text-2xl font-normal">{t("sequences.firstEmail")}</DialogTitle>
				<div role="radiogroup" aria-label={t("sequences.firstEmail")} className="mt-4 space-y-1">
					{option("draft", t("sequences.yourDraft"), <>
						<span className="mt-0.5 block truncate text-[15px] font-medium text-neutral-900">{draft.subject || t("compose.subject")}</span>
						<span className="line-clamp-2 block text-sm text-neutral-600">{previewText(draft.text, 180)}</span>
					</>)}
					{option("template", t("sequences.templateOpening"), <>
						<TemplateText text={template.subject} variables={variables} className="mt-0.5 block truncate text-[15px] font-medium text-neutral-900" />
						<TemplateText text={previewText(template.body, 180)} variables={variables} className="line-clamp-2 block text-sm leading-6 text-neutral-600" />
					</>)}
				</div>
				<p className="mt-3 px-1 text-sm text-neutral-500">{choice === "template" ? t("sequences.draftSetAside") : " "}</p>
				{choice === "draft" && (
					<label className="mt-1 flex cursor-pointer items-center gap-3 px-1">
						<span className="min-w-0 flex-1 text-sm text-neutral-800">{t("sequences.saveDraftAsOpening")}</span>
						<Switch checked={save} onCheckedChange={setSave} aria-label={t("sequences.saveDraftAsOpening")} />
					</label>
				)}
				<div className="mt-6 flex justify-end gap-2">
					<button type="button" onClick={() => onOpenChange(false)} className="rounded-full px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">{t("common.cancel")}</button>
					<button type="button" onClick={() => { onOpenChange(false); onChoose(choice, choice === "draft" && save); }} className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
						{choice === "draft" ? t("sequences.useMyDraft") : t("sequences.useTemplateOpening")}
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
