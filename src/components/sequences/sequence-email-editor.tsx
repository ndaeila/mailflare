"use client";

import { useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Braces, Check, Plus } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { EditorShell, EditorWindow, editorRowClass, editorRowLabel } from "@/components/compose/editor-window";
import type { RichTextEditorApi } from "@/components/compose/rich-text-editor-types";
import { htmlToPlainText, textToHtml } from "@/components/compose/rich-text-utils";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SequenceStep } from "@/lib/sequences/types";
import { BUILTIN_VARIABLES, replySubject } from "@/lib/sequences/utils";
import { fieldLabel } from "./sequence-ui-utils";
import { MergeFieldInput } from "./merge-field-input";
import { TemplateText } from "./template-text";


function KindChips({ value, onChange }: { value: "reply" | "new"; onChange: (value: "reply" | "new") => void }) {
	const { t } = useLanguage();
	const options = [{ value: "reply" as const, label: t("sequences.replyInThread") }, { value: "new" as const, label: t("sequences.newEmail") }];
	return (
		<div role="radiogroup" aria-label={t("sequences.sendAs")} className="flex flex-wrap gap-1.5">
			{options.map((option) => {
				const selected = value === option.value;
				return (
					<button key={option.value} type="button" role="radio" aria-checked={selected} onClick={() => onChange(option.value)} className={cn("flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[13px] font-medium transition-colors", selected ? "border-transparent bg-blue-100 text-blue-900" : "border-neutral-300 text-neutral-700 hover:bg-neutral-100")}>
						{selected && <Check className="h-3.5 w-3.5" aria-hidden />}{option.label}
					</button>
				);
			})}
		</div>
	);
}

export function InsertFieldMenu({ fields, onInsert }: { fields: string[]; onInsert: (name: string) => void }) {
	const { t } = useLanguage();
	const [custom, setCustom] = useState(false);
	const [value, setValue] = useState("");
	const name = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "f_$1");
	const options = [...BUILTIN_VARIABLES, ...fields.filter((field) => !(BUILTIN_VARIABLES as readonly string[]).includes(field))];
	if (custom) {
		return (
			<span className="flex items-center gap-1">
				<input
					autoFocus
					value={value}
					onChange={(event) => setValue(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") { event.preventDefault(); if (name) onInsert(name); setCustom(false); setValue(""); }
						if (event.key === "Escape") { setCustom(false); setValue(""); }
					}}
					placeholder={t("sequences.customFieldPlaceholder")}
					aria-label={t("sequences.customField")}
					className="h-8 w-28 rounded-md border border-neutral-300 bg-transparent px-2 text-sm text-neutral-900 outline-none focus:border-blue-600"
				/>
				<button type="button" disabled={!name} onMouseDown={(event) => event.preventDefault()} onClick={() => { onInsert(name); setCustom(false); setValue(""); }} className="h-8 rounded-md px-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-40">{t("sequences.add")}</button>
			</span>
		);
	}
	return (
		<DropdownMenu.Root modal={false}>
			<Tooltip label={t("sequences.insertField")}>
				<DropdownMenu.Trigger aria-label={t("sequences.insertField")} onMouseDown={(event) => event.preventDefault()} className="flex items-center gap-1 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900">
					<Braces className="h-4 w-4" />
				</DropdownMenu.Trigger>
			</Tooltip>
			<DropdownMenu.Portal>
				<DropdownMenu.Content side="top" align="start" sideOffset={6} onCloseAutoFocus={(event) => event.preventDefault()} className="z-[70] min-w-48 rounded-2xl border border-neutral-200 bg-white p-1.5 text-sm shadow-xl">
					<DropdownMenu.Label className="px-3 pb-1 pt-1.5 text-xs text-neutral-500">{t("sequences.insertField")}</DropdownMenu.Label>
					{options.map((option) => (
						<DropdownMenu.Item key={option} onSelect={() => onInsert(option)} className="flex cursor-pointer items-center rounded-xl px-3 py-2 text-neutral-900 outline-none data-[highlighted]:bg-neutral-100">
							<span className="mf-merge-field">{fieldLabel(option, t)}</span>
						</DropdownMenu.Item>
					))}
					<DropdownMenu.Separator className="my-1 h-px bg-neutral-200" />
					<DropdownMenu.Item onSelect={() => setCustom(true)} className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-neutral-900 outline-none data-[highlighted]:bg-neutral-100">
						<Plus className="h-4 w-4" aria-hidden />{t("sequences.customField")}
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	);
}

/**
 * Edits one sequence email in the same compose interface as any other email: a dark title
 * bar, header rows (timing where To/Cc would be), Subject, the rich-text body with merge-field
 * chips, and the formatting toolbar with Done where Send would be.
 */
export function SequenceEmailEditor({ title, subtitle, step, position, fields = [], threadSubject, onDone, onCancel, busy, error }: {
	title: string;
	subtitle?: string;
	step: SequenceStep;
	position: number;
	fields?: string[];
	/** Subject a reply step will answer, for the "Re:" line. */
	threadSubject?: string;
	onDone: (step: SequenceStep) => void;
	onCancel: () => void;
	busy?: boolean;
	error?: string | null;
}) {
	const { t } = useLanguage();
	const [kind, setKind] = useState(step.kind);
	const [delayDays, setDelayDays] = useState(step.delayDays);
	const [sendTime, setSendTime] = useState(step.sendTime);
	const [condition, setCondition] = useState(step.condition);
	const [subject, setSubject] = useState(step.subject);
	const [html, setHtml] = useState(() => step.html || textToHtml(step.body));
	const editorApi = useRef<RichTextEditorApi | null>(null);
	const label = (name: string) => fieldLabel(name, t);

	function done() {
		const body = htmlToPlainText(html).trim();
		onDone({ kind, delayDays, sendTime, condition, subject: kind === "reply" ? "" : subject, body, html: body ? html : null });
	}

	return (
		<EditorShell
			id={`sequence-step-${position}`}
			title={title}
			subtitle={subtitle}
			onCancel={onCancel}
			onDone={done}
			busy={busy}
			error={error}
			html={html}
			onHtmlChange={setHtml}
			mergeFieldLabel={label}
			editorApi={editorApi}
			toolbarExtra={<InsertFieldMenu fields={fields} onInsert={(name) => editorApi.current?.insertField(name)} />}
			rows={position > 0 && (
				<>
					<div className={editorRowClass}>
						<span className={editorRowLabel}>{t("sequences.sendAs")}</span>
						<KindChips value={kind === "new" ? "new" : "reply"} onChange={setKind} />
					</div>
					<div className={cn(editorRowClass, "flex-wrap gap-y-1.5")}>
						<span className={editorRowLabel}>{t("sequences.when")}</span>
						<span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-neutral-800">
							<input
								type="number"
								min={0}
								max={365}
								inputMode="numeric"
								aria-label={t("sequences.delayDays")}
								value={Number.isFinite(delayDays) ? delayDays : ""}
								onChange={(event) => setDelayDays(Math.max(0, Math.min(365, Number(event.target.value) || 0)))}
								className="h-8 w-12 rounded-md border border-neutral-300 bg-transparent text-center outline-none [appearance:textfield] focus:border-blue-600 [&::-webkit-inner-spin-button]:appearance-none"
							/>
							<span>{t("sequences.daysAfterPrevious")}</span>
							<span className="text-neutral-500">{t("sequences.at")}</span>
							<input type="time" step={60} aria-label={t("schedule.time")} value={sendTime ?? ""} onChange={(event) => setSendTime(event.target.value || null)} className="h-8 rounded-md border border-neutral-300 bg-transparent px-1.5 outline-none focus:border-blue-600" />
						</span>
					</div>
					<label className={cn(editorRowClass, "cursor-pointer")}>
						<span className={editorRowLabel}>{t("sequences.onlyIf")}</span>
						<span className="min-w-0 flex-1 text-neutral-800">{t("sequences.holdIfReplied")}</span>
						<Switch checked={condition === "no_reply"} onCheckedChange={(on) => setCondition(on ? "no_reply" : "always")} aria-label={t("sequences.holdIfReplied")} />
					</label>
				</>
			)}
			subject={kind === "reply" ? (
				<p className="flex h-8 items-center truncate text-sm text-neutral-500 max-md:text-base">{threadSubject ? <TemplateText text={replySubject(threadSubject)} tags /> : t("sequences.replySubject")}</p>
			) : (
				<MergeFieldInput value={subject} onChange={setSubject} label={label} placeholder={t("compose.subject")} ariaLabel={t("compose.subject")} className="max-md:text-base" />
			)}
		/>
	);
}

/** The sequence email editor in a compose-sized window. */
export function SequenceEmailWindow({ open, onOpenChange, ...props }: Omit<React.ComponentProps<typeof SequenceEmailEditor>, "onCancel"> & { open: boolean; onOpenChange: (open: boolean) => void }) {
	return (
		<EditorWindow open={open} onOpenChange={onOpenChange} title={props.title}>
			<SequenceEmailEditor {...props} onCancel={() => onOpenChange(false)} />
		</EditorWindow>
	);
}
