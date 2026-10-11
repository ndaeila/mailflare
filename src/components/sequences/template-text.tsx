"use client";

import { Fragment } from "react";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";
import { fieldLabel } from "./sequence-ui-utils";

const PLACEHOLDER = /\{\{\s*([a-zA-Z]\w*)\s*\}\}/g;

/** Neutral chip for a merge field, like Gmail's mail-merge tags. */
export const mergeChipClass = "inline-block rounded-md bg-neutral-200/80 px-1.5 text-[0.92em] font-medium leading-[1.45] text-neutral-800";

/**
 * Template text as the recipient will read it: a {{field}} with a value shows that value;
 * one without a value (or every one, with `tags`) shows as a chip with a friendly label.
 */
export function TemplateText({ text, variables = {}, tags = false, className }: { text: string; variables?: Record<string, string>; tags?: boolean; className?: string }) {
	const { t } = useLanguage();
	const parts: React.ReactNode[] = [];
	let last = 0;
	for (const match of text.matchAll(PLACEHOLDER)) {
		const index = match.index ?? 0;
		if (index > last) parts.push(text.slice(last, index));
		const name = match[1];
		const value = variables[name]?.trim();
		parts.push(value && !tags ? value : <span key={`${index}-${name}`} className={mergeChipClass}>{fieldLabel(name, t)}</span>);
		last = index + match[0].length;
	}
	if (last < text.length) parts.push(text.slice(last));
	return <span className={cn(className)}>{parts.map((part, index) => <Fragment key={index}>{part}</Fragment>)}</span>;
}
