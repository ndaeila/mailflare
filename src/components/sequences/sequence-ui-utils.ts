import type { SequenceStep, SequenceSummary } from "@/lib/sequences/types";
import { stepDays } from "@/lib/sequences/utils";
import type { Translator } from "@/lib/i18n/utils";

/** "3 emails · 10 days · stops on reply" */
export function sequenceMeta(steps: SequenceStep[], t: Translator): string {
	const days = stepDays(steps);
	const span = days[days.length - 1] ?? 0;
	const parts = [t("sequences.emails", { count: steps.length })];
	if (steps.length > 1) parts.push(t("sequences.days", { count: span }));
	parts.push(steps.slice(1).some((step) => step.condition === "no_reply") ? t("sequences.stopsOnReply") : t("sequences.alwaysSends"));
	return parts.join(" · ");
}

/** "3 emails · day 0, 4, 10 · stops on reply" for the Sequences list. */
export function sequenceListMeta(sequence: SequenceSummary, t: Translator): string {
	const parts = [t("sequences.emails", { count: sequence.steps.length }), t("sequences.dayList", { days: stepDays(sequence.steps).join(", ") })];
	parts.push(sequence.steps.slice(1).some((step) => step.condition === "no_reply") ? t("sequences.stopsOnReply") : t("sequences.alwaysSends"));
	return parts.join(" · ");
}

/** "Day 4 · if no reply" */
export function stepWhen(step: SequenceStep, day: number, t: Translator): string {
	return `${t("sequences.day", { day })} · ${step.condition === "no_reply" ? t("sequences.ifNoReply") : t("sequences.always")}`;
}

export function applyOverrides(steps: SequenceStep[], overrides: Record<number, SequenceStep>): SequenceStep[] {
	return steps.map((step, index) => overrides[index] ?? step);
}

/** First line-ish preview of a body. */
export function previewText(body: string, max = 140): string {
	const flat = body.replace(/\s+/g, " ").trim();
	return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
