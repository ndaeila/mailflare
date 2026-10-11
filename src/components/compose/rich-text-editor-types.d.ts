import type { TranslationKey } from "@/lib/i18n/types";
export type RichTextEditorProps = {
	id: string;
	/** Editable HTML. */
	value: string;
	onChange: (html: string) => void;
	/** Quoted or forwarded HTML shown folded under the editable area. */
	quotedHtml?: string | null;
	disabled?: boolean;
	placeholder?: string;
	className?: string;
	toolbarStart?: React.ReactNode;
	toolbarEnd?: React.ReactNode;
	footerContent?: React.ReactNode;
	/** When set, {{field}} placeholders show as atomic chips with this label and are
	 * serialized back to {{field}} in onChange (sequence mail merge). */
	mergeFieldLabel?: (name: string) => string;
	/** Filled with editor commands the parent can call, e.g. inserting a merge field at the caret. */
	editorApi?: React.MutableRefObject<RichTextEditorApi | null>;
};

export type RichTextEditorApi = {
	insertField: (name: string) => void;
};

export type ToolbarCommand = {
	command: string;
	labelKey: TranslationKey;
	icon: React.ComponentType<{ className?: string }>;
	value?: string;
};
