"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/auth/client";
import { EditorShell, EditorWindow } from "./editor-window";
import { htmlToPlainText, textToHtml } from "./rich-text-utils";
import type { ComposeTemplate } from "./template-types";

/** Create or edit a template in the compose interface: Subject is its name, the body is the email. */
export function TemplateEditorWindow({ open, onOpenChange, template, initial, mailboxId, from, onSaved }: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Existing template to edit; omit to create one. */
	template?: ComposeTemplate | null;
	/** Starting content for a new template, e.g. the email being written. */
	initial?: { subject: string; html: string } | null;
	mailboxId?: string | null;
	from: string;
	onSaved?: (template: ComposeTemplate) => void;
}) {
	const { t } = useLanguage();
	return (
		<EditorWindow open={open} onOpenChange={onOpenChange} title={template ? t("template.edit") : t("template.new")}>
			<TemplateEditor
				template={template}
				initial={initial}
				mailboxId={mailboxId}
				from={from}
				onCancel={() => onOpenChange(false)}
				onSaved={(saved) => { onSaved?.(saved); onOpenChange(false); }}
			/>
		</EditorWindow>
	);
}

function TemplateEditor({ template, initial, mailboxId, from, onCancel, onSaved }: {
	template?: ComposeTemplate | null;
	initial?: { subject: string; html: string } | null;
	mailboxId?: string | null;
	from: string;
	onCancel: () => void;
	onSaved: (template: ComposeTemplate) => void;
}) {
	const { t } = useLanguage();
	const [title, setTitle] = useState(template?.subject ?? initial?.subject ?? "");
	const [html, setHtml] = useState(template ? template.htmlBody ?? textToHtml(template.textBody ?? "") : initial?.html ?? "");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function save() {
		const text = htmlToPlainText(html).trim();
		if (!title.trim() || !text) { setError(t("template.required")); return; }
		setSaving(true);
		setError(null);
		try {
			const response = await authFetch(template ? `/api/templates/${template.id}` : "/api/templates", {
				method: template ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ mailboxId, from, title, text, html }),
			});
			const data = await response.json().catch(() => null) as { template?: ComposeTemplate; error?: string } | null;
			if (!response.ok || !data?.template) throw new Error(data?.error || t("template.saveFailed"));
			window.dispatchEvent(new Event("mailflare:templates-changed"));
			onSaved(data.template);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t("template.saveFailed"));
		} finally {
			setSaving(false);
		}
	}

	return (
		<EditorShell
			id="template-body"
			title={template ? t("template.edit") : t("template.new")}
			onCancel={onCancel}
			onDone={() => void save()}
			doneLabel={saving ? t("template.saving") : t("template.save")}
			busy={saving}
			error={error}
			html={html}
			onHtmlChange={setHtml}
			subject={<Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("compose.subject")} aria-label={t("template.title")} maxLength={200} className="h-8 border-0 px-0 py-1 shadow-none focus-visible:ring-0 max-md:text-base" />}
		/>
	);
}
