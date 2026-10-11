import { getEmailDisplayName, getFirstEmailAddressEntry, getEmailAddress } from "@/lib/email/address";
import { dateFromZonedFields, zonedDateFields } from "@/lib/time/utils";
import type { SequenceStep, SequenceStepInput } from "./types";

export const MAX_SEQUENCE_STEPS = 10;
export const BUILTIN_VARIABLES = ["first_name", "last_name", "name", "email"] as const;
const PLACEHOLDER = /\{\{\s*([a-zA-Z][\w]*)\s*\}\}/g;

/** Validates and fills defaults; throws a readable error for bad input. */
export function normalizeSequenceSteps(input: unknown): SequenceStep[] {
	if (!Array.isArray(input) || input.length === 0) throw new Error("A sequence needs at least an opening email");
	if (input.length > MAX_SEQUENCE_STEPS) throw new Error(`A sequence can have at most ${MAX_SEQUENCE_STEPS} emails`);
	return input.map((raw, index) => normalizeStep(raw as SequenceStepInput, index));
}

export function normalizeStep(raw: SequenceStepInput, index: number): SequenceStep {
	const label = index === 0 ? "The opening email" : `Step ${index + 1}`;
	const kind = index === 0 ? "opening" : raw.kind === "new" ? "new" : "reply";
	const delayDays = index === 0 ? 0 : Math.round(Number(raw.delayDays ?? 3));
	if (!Number.isFinite(delayDays) || delayDays < 0 || delayDays > 365) throw new Error(`${label}: delay must be 0 to 365 days`);
	const sendTime = raw.sendTime == null || raw.sendTime === "" ? null : String(raw.sendTime);
	if (sendTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime)) throw new Error(`${label}: send time must be HH:MM`);
	const condition = raw.condition === "always" ? "always" : "no_reply";
	const subject = String(raw.subject ?? "").trim();
	const body = String(raw.body ?? "").replace(/\r\n?/g, "\n").trim();
	if (kind !== "reply" && !subject) throw new Error(`${label} needs a subject`);
	if (subject.length > 500) throw new Error(`${label}: subject is too long`);
	if (!body) throw new Error(`${label} needs a message`);
	if (body.length > 40_000) throw new Error(`${label}: message is too long`);
	return { kind, delayDays, sendTime: index === 0 ? null : sendTime, condition: index === 0 ? "always" : condition, subject: kind === "reply" ? "" : subject, body };
}

/** Merges a partial edit into a step and re-validates it. */
export function applyStepEdit(step: SequenceStep, edit: SequenceStepInput, index: number): SequenceStep {
	return normalizeStep({ ...step, ...Object.fromEntries(Object.entries(edit).filter(([, value]) => value !== undefined)) }, index);
}

export function placeholdersIn(text: string): string[] {
	return [...new Set([...text.matchAll(PLACEHOLDER)].map((match) => match[1]))];
}

/** Placeholder names a sequence uses that the sender has to fill in (built-ins excluded). */
export function sequenceVariables(steps: SequenceStep[]): string[] {
	const names = new Set<string>();
	for (const step of steps) for (const name of placeholdersIn(`${step.subject}\n${step.body}`)) names.add(name);
	return [...names].filter((name) => !(BUILTIN_VARIABLES as readonly string[]).includes(name));
}

/** first_name, last_name, name and email from the first To recipient. */
export function builtinVariables(to: string): Record<string, string> {
	const entry = getFirstEmailAddressEntry(to);
	const email = getEmailAddress(entry);
	const display = getEmailDisplayName(entry);
	const hasName = !!display && display !== email && !display.includes("@") && display !== email.split("@")[0];
	const parts = hasName ? display.trim().split(/\s+/) : [];
	const first = parts[0] ?? "";
	return { email, name: hasName ? display.trim() : "", first_name: first ? capitalize(first) : "", last_name: parts.length > 1 ? parts[parts.length - 1] : "" };
}

function capitalize(value: string) {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Replaces {{name}} placeholders; names with no value are reported in missing and left as-is. */
export function renderTemplate(text: string, variables: Record<string, string>): { text: string; missing: string[] } {
	const missing = new Set<string>();
	const rendered = text.replace(PLACEHOLDER, (whole, name: string) => {
		const value = variables[name];
		if (value === undefined || value === "") { missing.add(name); return whole; }
		return value;
	});
	return { text: rendered, missing: [...missing] };
}

/** Every placeholder across the steps that has no value. */
export function missingVariables(steps: SequenceStep[], variables: Record<string, string>): string[] {
	const missing = new Set<string>();
	for (const step of steps) for (const name of renderTemplate(`${step.subject}\n${step.body}`, variables).missing) missing.add(name);
	return [...missing];
}

/** Day offsets from the opening: [0, 4, 10] for delays [0, 4, 6]. */
export function stepDays(steps: Pick<SequenceStep, "delayDays">[]): number[] {
	let total = 0;
	return steps.map((step, index) => (total += index === 0 ? 0 : step.delayDays));
}

/** When a step goes out, counted from the previous step's send time. */
export function stepSendTime(previous: Date, step: Pick<SequenceStep, "delayDays" | "sendTime">, timeZone: string): Date {
	if (!step.sendTime) return new Date(previous.getTime() + step.delayDays * 86_400_000);
	const fields = zonedDateFields(previous, timeZone);
	fields.setUTCDate(fields.getUTCDate() + step.delayDays);
	const [hours, minutes] = step.sendTime.split(":").map(Number);
	fields.setUTCHours(hours, minutes, 0, 0);
	let result = dateFromZonedFields(fields, timeZone);
	// "0 days later at 9:00" after a 3 PM send means the next morning, not the past.
	while (result.getTime() <= previous.getTime()) {
		fields.setUTCDate(fields.getUTCDate() + 1);
		result = dateFromZonedFields(fields, timeZone);
	}
	return result;
}

export function replySubject(subject: string | null | undefined): string {
	const clean = (subject ?? "").trim();
	return /^re:/i.test(clean) ? clean : `Re: ${clean}`;
}

/** "3 emails · day 0, 4, 10 · stops on reply" */
export function describeSequence(steps: SequenceStep[]): { emails: number; days: number[]; stopsOnReply: boolean } {
	return { emails: steps.length, days: stepDays(steps), stopsOnReply: steps.slice(1).some((step) => step.condition === "no_reply") };
}
