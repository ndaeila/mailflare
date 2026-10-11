"use client";

import { ArrowLeft, X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RichTextEditor } from "./rich-text-editor";
import type { RichTextEditorApi } from "./rich-text-editor-types";

/** Header row styling shared with the composer's From/To rows. */
export const editorRowClass = "flex min-h-10 shrink-0 items-center gap-3 border-b border-neutral-100 px-4 py-1 text-sm max-md:min-h-12 max-md:text-base";
export const editorRowLabel = "w-14 shrink-0 text-neutral-500";

/**
 * The compose window without recipients: used to edit templates and sequence emails so they
 * look and behave like writing an email. Desktop: dark title bar, Done where Send would be.
 * Phones: Gmail's full-screen layout, a light top bar with Done, and formatting above the keyboard.
 */
export function EditorShell({ id, title, subtitle, onCancel, onDone, doneLabel, busy, error, rows, subject, html, onHtmlChange, placeholder, mergeFieldLabel, editorApi, toolbarExtra }: {
	id: string;
	title: string;
	subtitle?: string;
	onCancel: () => void;
	onDone: () => void;
	doneLabel?: string;
	busy?: boolean;
	error?: string | null;
	/** Rows between the title bar and the subject, like To/Cc in the composer. */
	rows?: React.ReactNode;
	subject: React.ReactNode;
	html: string;
	onHtmlChange: (html: string) => void;
	placeholder?: string;
	mergeFieldLabel?: (name: string) => string;
	editorApi?: React.MutableRefObject<RichTextEditorApi | null>;
	/** Extra toolbar buttons, shown after Done on desktop and in the phone formatting bar. */
	toolbarExtra?: React.ReactNode;
}) {
	const { t } = useLanguage();
	const label = doneLabel ?? t("sequences.done");
	return (
		<div className="flex h-full min-h-0 flex-col bg-white" onKeyDown={(event) => { if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") event.preventDefault(); }}>
			<div className="flex h-9 shrink-0 items-center gap-2 bg-neutral-800 px-2 text-sm font-medium text-white dark:bg-neutral-100 max-md:hidden">
				<button type="button" onClick={onCancel} aria-label={t("sequences.back")} className="rounded p-1 text-neutral-300 hover:bg-neutral-700 hover:text-white dark:text-neutral-600 dark:hover:bg-neutral-200"><ArrowLeft className="h-4 w-4" /></button>
				<span className="min-w-0 flex-1 truncate dark:text-neutral-900">
					{title}{subtitle && <span className="font-normal text-neutral-300 dark:text-neutral-600"> · {subtitle}</span>}
				</span>
				<button type="button" onClick={onCancel} aria-label={t("common.cancel")} className="rounded p-1 text-neutral-300 hover:bg-neutral-700 hover:text-white dark:text-neutral-600 dark:hover:bg-neutral-200"><X className="h-4 w-4" /></button>
			</div>
			<div className="flex h-14 shrink-0 items-center gap-2 px-2 md:hidden">
				<button type="button" onClick={onCancel} aria-label={t("common.cancel")} className="rounded-full bg-neutral-100 p-2 text-neutral-700"><X className="h-5 w-5" /></button>
				<span className="min-w-0 flex-1 px-1">
					<span className="block truncate text-base font-medium text-neutral-900">{title}</span>
					{subtitle && <span className="block truncate text-xs text-neutral-500">{subtitle}</span>}
				</span>
				<button type="button" onClick={onDone} disabled={busy} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{label}</button>
			</div>
			{error && <p role="alert" className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
			{rows}
			<div className="shrink-0 border-b border-neutral-100 px-4 py-1 max-md:py-2">{subject}</div>
			<RichTextEditor
				id={id}
				value={html}
				onChange={onHtmlChange}
				placeholder={placeholder ?? t("compose.bodyPlaceholder")}
				mergeFieldLabel={mergeFieldLabel}
				editorApi={editorApi}
				mobileToolbarExtra={toolbarExtra}
				toolbarStart={
					<>
						<Button type="button" size="sm" disabled={busy} onClick={onDone} className="mr-1 px-5">{label}</Button>
						{toolbarExtra}
					</>
				}
			/>
		</div>
	);
}

/** EditorShell in a compose-sized window: centered like the composer's expanded mode, full screen on phones. */
export function EditorWindow({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: React.ReactNode }) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				closeClassName="hidden"
				onOpenAutoFocus={(event) => event.preventDefault()}
				className="h-[86vh] w-[min(860px,calc(100vw-32px))] overflow-hidden rounded-lg p-0 max-md:inset-0 max-md:h-dvh max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none"
			>
				<DialogTitle className="sr-only">{title}</DialogTitle>
				{open && children}
			</DialogContent>
		</Dialog>
	);
}
