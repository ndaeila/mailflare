"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";

const PLACEHOLDER = /\{\{\s*([a-zA-Z]\w*)\s*\}\}/g;

export const placeholderChipClass = "rounded bg-[#fde7d6] px-1 text-[#9a4a10] dark:bg-[#4a3022] dark:text-[#fcc9a6]";

/** Template text with each {{field}} shown as a chip: its value when known, else its name. */
export function TemplateText({ text, variables = {}, className }: { text: string; variables?: Record<string, string>; className?: string }) {
	const parts: React.ReactNode[] = [];
	let last = 0;
	for (const match of text.matchAll(PLACEHOLDER)) {
		const index = match.index ?? 0;
		if (index > last) parts.push(text.slice(last, index));
		const name = match[1];
		const value = variables[name];
		parts.push(<span key={`${index}-${name}`} className={cn(placeholderChipClass, !value && "font-medium")}>{value || name}</span>);
		last = index + match[0].length;
	}
	if (last < text.length) parts.push(text.slice(last));
	return <span className={className}>{parts.map((part, index) => <Fragment key={index}>{part}</Fragment>)}</span>;
}
