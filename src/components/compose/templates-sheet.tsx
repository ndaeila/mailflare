"use client";

import { FilePlus2, FileText, Pencil, Plus } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { textToHtml } from "./rich-text-utils";
import { useTemplates } from "./use-templates";
import type { ComposeTemplate } from "./template-types";

/** Templates as a bottom sheet for phones, where Gmail uses sheets instead of nested menus. */
export function TemplatesSheet({ open, onOpenChange, onApply, onEdit, onNew, onSaveCurrent }: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onApply: (template: { title: string; html: string }) => void;
	onEdit: (template: ComposeTemplate) => void;
	onNew: () => void;
	onSaveCurrent?: () => void;
}) {
	const { t } = useLanguage();
	const { templates } = useTemplates(open);
	const close = (then: () => void) => () => { onOpenChange(false); then(); };
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				closeClassName="hidden"
				onOpenAutoFocus={(event) => event.preventDefault()}
				className="bottom-0 top-auto max-h-[80dvh] w-full max-w-none translate-y-0 overflow-y-auto rounded-b-none rounded-t-[28px] px-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:bottom-auto sm:top-1/2 sm:w-[min(420px,calc(100vw-32px))] sm:-translate-y-1/2 sm:rounded-[28px]"
			>
				<div className="mx-auto mb-2 h-1 w-8 rounded-full bg-neutral-300 sm:hidden" aria-hidden />
				<DialogTitle className="px-6 pb-2 pt-2 text-xl font-normal">{t("template.templates")}</DialogTitle>
				{templates === null && <div className="mx-6 my-2 h-12 animate-pulse rounded-xl bg-neutral-100" />}
				{templates?.length === 0 && <p className="px-6 py-3 text-sm text-neutral-500">{t("template.none")}</p>}
				<div role="list">
					{templates?.map((template) => (
						<div key={template.id} role="listitem" className="flex items-center">
							<button type="button" onClick={close(() => onApply({ title: template.subject ?? "", html: template.htmlBody ?? textToHtml(template.textBody ?? "") }))} className="flex min-w-0 flex-1 items-center gap-4 py-3 pl-6 text-left active:bg-neutral-200">
								<FileText className="h-5 w-5 shrink-0 text-neutral-600" aria-hidden />
								<span className="truncate text-base text-neutral-900">{template.subject || t("template.untitled")}</span>
							</button>
							<button type="button" onClick={close(() => onEdit(template))} aria-label={t("template.edit")} className="mr-3 rounded-full p-2.5 text-neutral-600 active:bg-neutral-200"><Pencil className="h-4.5 w-4.5" /></button>
						</div>
					))}
				</div>
				<div className="mt-1 border-t border-neutral-200 pt-1">
					{onSaveCurrent && (
						<button type="button" onClick={close(onSaveCurrent)} className="flex w-full items-center gap-4 px-6 py-3 text-left text-base text-neutral-900 active:bg-neutral-200">
							<FilePlus2 className="h-5 w-5 text-neutral-600" aria-hidden />{t("template.saveCurrent")}
						</button>
					)}
					<button type="button" onClick={close(onNew)} className="flex w-full items-center gap-4 px-6 py-3 text-left text-base font-medium text-blue-700 active:bg-neutral-200">
						<Plus className="h-5 w-5" aria-hidden />{t("template.new")}
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
