"use client";

import { useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { SequenceStep } from "@/lib/sequences/types";
import { BUILTIN_VARIABLES } from "@/lib/sequences/utils";
import { fieldLabel } from "./sequence-ui-utils";

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
	return (
		<div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-full border border-neutral-300">
			{options.map((option, index) => {
				const selected = value === option.value;
				return (
					<button
						key={option.value}
						type="button"
						role="radio"
						aria-checked={selected}
						onClick={() => onChange(option.value)}
						className={cn("flex h-9 items-center gap-1.5 px-4 text-sm font-medium transition-colors", index > 0 && "border-l border-neutral-300", selected ? "bg-blue-100 text-blue-900" : "text-neutral-700 hover:bg-neutral-100")}
					>
						{selected && <Check className="h-4 w-4" aria-hidden />}
						{option.label}
					</button>
				);
			})}
		</div>
	);
}

const lineInput = "w-full border-b border-neutral-200 bg-transparent py-2 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-blue-600";
const boxInput = "h-9 rounded-lg border border-neutral-300 bg-transparent px-2 text-sm text-neutral-900 outline-none focus:border-blue-600";

/** The fields of one step: how and when it sends, then subject and message with merge-field chips. */
export function StepForm({ step, position, onChange, fields = [], idPrefix }: { step: SequenceStep; position: number; onChange: (step: SequenceStep) => void; fields?: string[]; idPrefix: string }) {
	const { t } = useLanguage();
	const bodyRef = useRef<HTMLTextAreaElement>(null);
	const set = (patch: Partial<SequenceStep>) => onChange({ ...step, ...patch });
	const insertable = [...BUILTIN_VARIABLES.filter((name) => name !== "last_name"), ...fields.filter((name) => !(BUILTIN_VARIABLES as readonly string[]).includes(name))];

	function insertField(name: string) {
		const area = bodyRef.current;
		const token = `{{${name}}}`;
		if (!area) { set({ body: `${step.body}${token}` }); return; }
		const start = area.selectionStart ?? step.body.length;
		const end = area.selectionEnd ?? start;
		set({ body: `${step.body.slice(0, start)}${token}${step.body.slice(end)}` });
		requestAnimationFrame(() => { area.focus(); area.setSelectionRange(start + token.length, start + token.length); });
	}

	return (
		<div className="space-y-5">
			{position > 0 && (
				<>
					<Segmented label={t("sequences.sendAs")} value={step.kind === "new" ? "new" : "reply"} onChange={(kind) => set({ kind, subject: kind === "new" ? step.subject : "" })} options={[{ value: "reply", label: t("sequences.replyInThread") }, { value: "new", label: t("sequences.newEmail") }]} />
					<div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[15px] text-neutral-800">
						<input
							type="number"
							min={0}
							max={365}
							inputMode="numeric"
							aria-label={t("sequences.delayDays")}
							value={Number.isFinite(step.delayDays) ? step.delayDays : ""}
							onChange={(event) => set({ delayDays: Math.max(0, Math.min(365, Number(event.target.value) || 0)) })}
							className={cn(boxInput, "w-16 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none")}
						/>
						<span>{t("sequences.daysAfterPrevious")}</span>
						<span className="text-neutral-500">{t("sequences.at")}</span>
						<input type="time" step={60} aria-label={t("schedule.time")} value={step.sendTime ?? ""} onChange={(event) => set({ sendTime: event.target.value || null })} className={cn(boxInput, "w-32")} />
					</div>
					<label className="flex cursor-pointer items-center gap-3">
						<span className="min-w-0 flex-1">
							<span className="block text-[15px] text-neutral-900">{t("sequences.holdIfReplied")}</span>
							<span className="block text-xs text-neutral-500">{step.condition === "no_reply" ? t("sequences.holdIfRepliedOn") : t("sequences.alwaysHint")}</span>
						</span>
						<Switch checked={step.condition === "no_reply"} onCheckedChange={(on) => set({ condition: on ? "no_reply" : "always" })} aria-label={t("sequences.holdIfReplied")} />
					</label>
				</>
			)}
			<div className="space-y-1">
				{step.kind === "reply" ? (
					<p className="border-b border-neutral-200 py-2 text-[15px] text-neutral-500">{t("sequences.replySubject")}</p>
				) : (
					<input id={`${idPrefix}-subject`} aria-label={t("sequences.subject")} placeholder={t("sequences.subject")} value={step.subject} onChange={(event) => set({ subject: event.target.value })} className={lineInput} />
				)}
				<textarea
					ref={bodyRef}
					id={`${idPrefix}-body`}
					aria-label={t("sequences.message")}
					placeholder={t("sequences.message")}
					value={step.body}
					onChange={(event) => set({ body: event.target.value })}
					rows={8}
					className="block min-h-40 w-full resize-y bg-transparent py-2 text-[15px] leading-6 text-neutral-900 outline-none placeholder:text-neutral-400"
				/>
			</div>
			<div className="flex flex-wrap items-center gap-1.5">
				<span className="mr-1 text-xs text-neutral-500">{t("sequences.insertField")}</span>
				{insertable.map((name) => (
					<button key={name} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertField(name)} className="flex h-7 items-center gap-1 rounded-lg border border-neutral-300 px-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
						<Plus className="h-3 w-3" aria-hidden />{fieldLabel(name, t)}
					</button>
				))}
				<NewFieldButton onAdd={insertField} />
			</div>
		</div>
	);
}

function NewFieldButton({ onAdd }: { onAdd: (name: string) => void }) {
	const { t } = useLanguage();
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState("");
	const name = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "f_$1");
	if (!editing) return <button type="button" onClick={() => setEditing(true)} className="h-7 rounded-lg px-2 text-xs font-medium text-blue-700 hover:bg-blue-50">{t("sequences.customField")}</button>;
	return (
		<span className="flex items-center gap-1">
			<input
				autoFocus
				value={value}
				onChange={(event) => setValue(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") { event.preventDefault(); if (name) onAdd(name); setValue(""); setEditing(false); }
					if (event.key === "Escape") { setValue(""); setEditing(false); }
				}}
				placeholder={t("sequences.customFieldPlaceholder")}
				className="h-7 w-32 rounded-lg border border-neutral-300 bg-transparent px-2 text-xs text-neutral-900 outline-none focus:border-blue-600"
			/>
			<button type="button" disabled={!name} onClick={() => { onAdd(name); setValue(""); setEditing(false); }} className="h-7 rounded-lg px-2 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-40">{t("sequences.add")}</button>
		</span>
	);
}

/** Material-style dialog for one step; full screen on phones like Gmail's mobile compose. */
export function StepDialog({ open, onOpenChange, title, subtitle, step, position, fields, onSave, busy, error }: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	subtitle?: string;
	step: SequenceStep | null;
	position: number;
	fields?: string[];
	onSave: (step: SequenceStep) => void;
	busy?: boolean;
	error?: string | null;
}) {
	const { t } = useLanguage();
	const [draft, setDraft] = useState<SequenceStep | null>(step);
	// Start from the step each time the dialog opens; edits stay local until Save.
	const [seenOpen, setSeenOpen] = useState(open);
	if (seenOpen !== open) {
		setSeenOpen(open);
		if (open) setDraft(step);
	}
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				closeClassName="hidden"
				onOpenAutoFocus={(event) => event.preventDefault()}
				className="flex max-h-none flex-col p-0 max-sm:inset-0 max-sm:h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:max-h-[calc(100dvh-4rem)] sm:w-[min(560px,calc(100vw-32px))] sm:rounded-[28px]"
			>
				<div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-3 sm:px-6 sm:pt-6">
					<button type="button" onClick={() => onOpenChange(false)} aria-label={t("common.cancel")} className="rounded-full p-2 text-neutral-700 hover:bg-neutral-100 sm:hidden"><X className="h-5 w-5" /></button>
					<div className="min-w-0 flex-1">
						<DialogTitle className="truncate text-[20px] font-normal text-neutral-900 sm:text-2xl">{title}</DialogTitle>
						{subtitle && <p className="truncate text-sm text-neutral-500">{subtitle}</p>}
					</div>
					<button type="button" disabled={busy || !draft} onClick={() => draft && onSave(draft)} className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:hidden">{t("sequences.save")}</button>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2 sm:px-6">
					{error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
					{draft && <StepForm step={draft} position={position} onChange={setDraft} fields={fields} idPrefix={`step-${position}`} />}
				</div>
				<div className="hidden shrink-0 justify-end gap-2 px-6 pb-6 pt-2 sm:flex">
					<button type="button" onClick={() => onOpenChange(false)} className="rounded-full px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">{t("common.cancel")}</button>
					<button type="button" disabled={busy || !draft} onClick={() => draft && onSave(draft)} className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{t("sequences.save")}</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
