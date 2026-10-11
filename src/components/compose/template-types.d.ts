export type ComposeTemplate = {
	id: string;
	subject: string | null;
	htmlBody: string | null;
	textBody: string | null;
};

export type TemplateMenuProps = {
	onApply: (template: { title: string; html: string }) => void;
	onNew: () => void;
	onEdit: (template: ComposeTemplate) => void;
	/** Shown when there is an email in the composer to save. */
	onSaveCurrent?: () => void;
};
