import type { SequenceStep, SequenceSummary } from "@/lib/sequences/types";
import { stepDays } from "@/lib/sequences/utils";
import type { Translator } from "@/lib/i18n/utils";

const BUILTIN_LABELS = { first_name: "sequences.field.firstName", last_name: "sequences.field.lastName", name: "sequences.field.name", email: "sequences.field.email" } as const;

/** first_name → "First name", deal_size → "Deal size". */
export function fieldLabel(name: string, t: Translator): string {
	if (Object.hasOwn(BUILTIN_LABELS, name)) return t(BUILTIN_LABELS[name as keyof typeof BUILTIN_LABELS]);
	const words = name.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim().toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "2 follow-ups · stops if they reply" */
export function followUpSummary(steps: SequenceStep[], t: Translator): string {
	const followUps = steps.length - 1;
	const parts = [followUps > 0 ? t("sequences.followUps", { count: followUps }) : t("sequences.noFollowUps")];
	if (steps.slice(1).some((step) => step.condition === "no_reply")) parts.push(t("sequences.stopsIfReply"));
	return parts.join(" · ");
}

/** "3 emails over 10 days" */
export function sequenceSpan(steps: SequenceStep[], t: Translator): string {
	const days = stepDays(steps);
	const span = days[days.length - 1] ?? 0;
	return steps.length > 1 ? t("sequences.emailsOverDays", { emails: steps.length, days: span }) : t("sequences.emails", { count: 1 });
}

export function sequenceStats(sequence: SequenceSummary, t: Translator): string {
	const { active, replied, total } = sequence.stats;
	const parts = [t("sequences.active", { count: active }), t("sequences.replied", { count: replied })];
	if (total > 0) parts.push(t("sequences.replyRate", { rate: Math.round((replied / total) * 100) }));
	return parts.join(" · ");
}

export function applyOverrides(steps: SequenceStep[], overrides: Record<number, SequenceStep>): SequenceStep[] {
	return steps.map((step, index) => overrides[index] ?? step);
}

/** One line of a body for previews, with placeholders left intact. */
export function previewText(body: string, max = 140): string {
	const flat = body.replace(/\s+/g, " ").trim();
	if (flat.length <= max) return flat;
	const cut = flat.slice(0, max);
	const open = cut.lastIndexOf("{{");
	return `${open > cut.lastIndexOf("}}") ? cut.slice(0, open) : cut}…`;
}

export { renderHtmlFields } from "@/lib/sequences/utils";
