"use client";

import { ChevronLeft, Info, Mail, Reply } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";
import type { SequenceStep } from "@/lib/sequences/types";

const fieldLabel = "mb-1.5 block text-xs font-medium text-neutral-500";
const inputClass = "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[15px] text-neutral-900 outline-none focus:border-blue-500";

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
	return (
		<div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1">
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					role="radio"
					aria-checked={value === option.value}
					onClick={() => onChange(option.value)}
					className={cn("h-9 rounded-lg text-sm transition-colors", value === option.value ? "bg-white font-semibold text-neutral-900 shadow-sm dark:bg-neutral-300" : "text-neutral-500 hover:text-neutral-800")}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}

/** Send as / When / Only if / Subject / Message for one sequence step. */
export function StepFields({ step, position, onChange, idPrefix }: { step: SequenceStep; position: number; onChange: (step: SequenceStep) => void; idPrefix: string }) {
	const { t } = useLanguage();
	const set = (patch: Partial<SequenceStep>) => onChange({ ...step, ...patch });
	if (position === 0) {
		return (
			<div className="space-y-4">
				<div>
					<label htmlFor={`${idPrefix}-subject`} className={fieldLabel}>{t("sequences.subject")}</label>
					<input id={`${idPrefix}-subject`} value={step.subject} onChange={(event) => set({ subject: event.target.value })} className={inputClass} />
				</div>
				<div>
					<label htmlFor={`${idPrefix}-body`} className={fieldLabel}>{t("sequences.message")}</label>
					<textarea id={`${idPrefix}-body`} value={step.body} onChange={(event) => set({ body: event.target.value })} rows={7} className="w-full resize-y rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[15px] leading-6 text-neutral-900 outline-none focus:border-blue-500" />
				</div>
			</div>
		);
	}
	return (
		<div className="space-y-4">
			<div>
				<span className={fieldLabel}>{t("sequences.sendAs")}</span>
				<Segmented label={t("sequences.sendAs")} value={step.kind === "new" ? "new" : "reply"} onChange={(kind) => set({ kind })} options={[{ value: "reply", label: t("sequences.replyInThread") }, { value: "new", label: t("sequences.newEmail") }]} />
			</div>
			<div>
				<span className={fieldLabel}>{t("sequences.when")}</span>
				<div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
					<label className={cn(inputClass, "flex items-center gap-2")}>
						<input
							type="number"
							min={0}
							max={365}
							inputMode="numeric"
							aria-label={t("sequences.when")}
							value={Number.isFinite(step.delayDays) ? step.delayDays : ""}
							onChange={(event) => set({ delayDays: Math.max(0, Math.min(365, Number(event.target.value) || 0)) })}
							className="w-9 shrink-0 bg-transparent text-[15px] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
						/>
						<span className="min-w-0 truncate text-[15px] text-neutral-900">{t("sequences.daysAfter", { step: position })}</span>
					</label>
					<input
						type="time"
						step={60}
						aria-label={t("schedule.time")}
						value={step.sendTime ?? ""}
						onChange={(event) => set({ sendTime: event.target.value || null })}
						className={inputClass}
						title={step.sendTime ? undefined : t("sequences.anyTime")}
					/>
				</div>
			</div>
			<div>
				<span className={fieldLabel}>{t("sequences.onlyIf")}</span>
				<Segmented label={t("sequences.onlyIf")} value={step.condition} onChange={(condition) => set({ condition })} options={[{ value: "no_reply", label: t("sequences.noReplyYet") }, { value: "always", label: t("sequences.alwaysOption") }]} />
			</div>
			{step.kind === "new" && (
				<div>
					<label htmlFor={`${idPrefix}-subject`} className={fieldLabel}>{t("sequences.subject")}</label>
					<input id={`${idPrefix}-subject`} value={step.subject} onChange={(event) => set({ subject: event.target.value })} className={inputClass} />
				</div>
			)}
			<div>
				<label htmlFor={`${idPrefix}-body`} className={fieldLabel}>{t("sequences.message")}</label>
				<textarea id={`${idPrefix}-body`} value={step.body} onChange={(event) => set({ body: event.target.value })} rows={7} className="w-full resize-y rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[15px] leading-6 text-neutral-900 outline-none focus:border-blue-500" />
			</div>
			<p className="flex items-start gap-2 rounded-xl border border-dashed border-neutral-300 px-3 py-2.5 text-xs leading-5 text-neutral-600">
				{step.kind === "new" ? <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> : <Reply className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
				<span>{step.kind === "new" ? t("sequences.newHint") : t("sequences.replyHint")}{step.condition === "always" && <> {t("sequences.alwaysHint")}</>}</span>
			</p>
		</div>
	);
}

export function PlaceholderHint() {
	const { t } = useLanguage();
	return (
		<p className="flex items-start gap-2 text-xs leading-5 text-neutral-500">
			<Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
			{t("sequences.placeholderHint", { examples: "{{first_name}}, {{last_name}}, {{name}}, {{email}}" })}
		</p>
	);
}

/** Full-height panel: "← Research outreach · Step 3   Done". */
export function StepEditorPanel({ title, step, position, onChange, onDone, onBack, busy, error }: {
	title: string;
	step: SequenceStep;
	position: number;
	onChange: (step: SequenceStep) => void;
	onDone: () => void;
	onBack: () => void;
	busy?: boolean;
	error?: string | null;
}) {
	const { t } = useLanguage();
	return (
		<div className="flex h-full min-h-0 flex-col bg-white">
			<div className="flex h-12 shrink-0 items-center gap-2 border-b border-neutral-100 px-3">
				<button type="button" onClick={onBack} aria-label={t("sequences.back")} className="rounded-full p-1.5 text-neutral-600 hover:bg-neutral-100"><ChevronLeft className="h-5 w-5" /></button>
				<span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-neutral-900">{title}</span>
				<button type="button" onClick={onDone} disabled={busy} className="rounded-full px-3 py-1.5 text-[15px] font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50">{t("sequences.done")}</button>
			</div>
			<div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
				{error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
				<StepFields step={step} position={position} onChange={onChange} idPrefix={`step-${position}`} />
				<PlaceholderHint />
			</div>
		</div>
	);
}
