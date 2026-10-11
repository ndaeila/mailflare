"use client";

import { useEffect, useRef } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { fieldsToEditorHtml } from "@/components/compose/merge-field-utils";
import { cn } from "@/lib/utils";

function escapeText(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Plain text of the field, with chips written back as {{field}}. */
function serialize(element: HTMLElement): string {
	let out = "";
	for (const node of element.childNodes) {
		if (node.nodeType === Node.TEXT_NODE) out += node.nodeValue ?? "";
		else if (node instanceof HTMLElement && node.dataset.mailflareField) out += `{{${node.dataset.mailflareField}}}`;
		else out += node.textContent ?? "";
	}
	return out.replace(/ /g, " ").replace(/\n/g, " ");
}

/** A one-line text field that shows {{field}} placeholders as merge chips, for subjects. */
export function MergeFieldInput({ id, value, onChange, label, placeholder, ariaLabel, className }: {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	label: (name: string) => string;
	placeholder?: string;
	ariaLabel?: string;
	className?: string;
}) {
	const ref = useRef<HTMLDivElement | null>(null);
	const labelRef = useRef(label);
	useEffect(() => { labelRef.current = label; }, [label]);

	useEffect(() => {
		const element = ref.current;
		if (!element || serialize(element) === value) return;
		element.innerHTML = fieldsToEditorHtml(escapeText(value), labelRef.current);
	}, [value]);

	function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key === "Enter") event.preventDefault();
	}

	function onPaste(event: ClipboardEvent<HTMLDivElement>) {
		event.preventDefault();
		document.execCommand("insertText", false, event.clipboardData.getData("text/plain").replace(/\s+/g, " "));
	}

	return (
		<div
			ref={ref}
			id={id}
			role="textbox"
			aria-label={ariaLabel}
			aria-multiline="false"
			contentEditable
			suppressContentEditableWarning
			data-placeholder={placeholder}
			onInput={() => ref.current && onChange(serialize(ref.current))}
			onKeyDown={onKeyDown}
			onPaste={onPaste}
			className={cn("min-h-8 overflow-hidden whitespace-nowrap py-1 text-sm leading-6 text-neutral-900 outline-none empty:before:pointer-events-none empty:before:text-neutral-400 empty:before:content-[attr(data-placeholder)]", className)}
		/>
	);
}
