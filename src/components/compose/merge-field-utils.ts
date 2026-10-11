const PLACEHOLDER = /\{\{\s*([a-zA-Z]\w*)\s*\}\}/g;
const CHIP = /<span\b[^>]*\bdata-mailflare-field="([a-zA-Z]\w*)"[^>]*>[\s\S]*?<\/span>/g;

function escapeText(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** One merge-field chip as the editor shows it. */
export function mergeFieldChipHtml(name: string, label: string): string {
	return `<span data-mailflare-field="${name}" contenteditable="false" class="mf-merge-field">${escapeText(label)}</span>`;
}

/** {{field}} in text nodes becomes a chip; placeholders inside attributes are left alone. */
export function fieldsToEditorHtml(html: string, label: (name: string) => string): string {
	if (!html.includes("{{") || typeof document === "undefined") return html;
	const template = document.createElement("template");
	template.innerHTML = html;
	const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
	const nodes: Text[] = [];
	for (let node = walker.nextNode(); node; node = walker.nextNode()) if ((node.nodeValue ?? "").includes("{{")) nodes.push(node as Text);
	for (const node of nodes) {
		const text = node.nodeValue ?? "";
		const fragment = document.createElement("template");
		let last = 0;
		let out = "";
		for (const match of text.matchAll(PLACEHOLDER)) {
			out += escapeText(text.slice(last, match.index)) + mergeFieldChipHtml(match[1], label(match[1]));
			last = (match.index ?? 0) + match[0].length;
		}
		if (!out) continue;
		fragment.innerHTML = out + escapeText(text.slice(last));
		node.replaceWith(fragment.content);
	}
	return template.innerHTML;
}

/** Chips back to {{field}} for storage and sending. */
export function fieldsFromEditorHtml(html: string): string {
	return html.replace(CHIP, (_whole, name: string) => `{{${name}}}`);
}
