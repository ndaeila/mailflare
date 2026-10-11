"use client";

import { useLanguage } from "@/components/language-provider";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { prepareEmailHtml } from "@/lib/email/html";
import { collapseQuotedEmailHtml } from "@/app/(dashboard)/inbox/[messageId]/quote-collapse-utils";
import { emailHasOwnColors, isDarkTheme, subscribeToTheme } from "./email-html-renderer-utils";

const BASE_STYLE = `
:host { display:block; min-width:0; isolation:isolate; contain:paint; }
.email-quote-toggle { margin-top:1.4em; }
.email-quote-toggle > summary { cursor:pointer; list-style:none; width:26px; border-radius:20px; background:var(--color-neutral-100, #ececec); color:var(--color-neutral-700, #444); text-align:center; }
.email-quote-toggle > summary::-webkit-details-marker { display:none; }
.email-quote-toggle > summary::before { content:'•••'; }
.email-quote-content { display:flow-root; }
`;

export function EmailHtmlRenderer({ html, className, preserveLeadingQuote = false }: {
	html: string; className?: string; preserveLeadingQuote?: boolean;
}) {
	const { t } = useLanguage();
	const host = useRef<HTMLDivElement>(null);
	const [allowedSource, setAllowedSource] = useState<string | null>(null);
	const [hasRemote, setHasRemote] = useState(false);
	const allowRemote = allowedSource === html;
	const dark = useSyncExternalStore(subscribeToTheme, isDarkTheme, () => false);
	useEffect(() => {
		if (!host.current) return;
		host.current.dir = document.documentElement.dir || "ltr";
		const root = host.current.shadowRoot ?? host.current.attachShadow({ mode: "open" });
		const prepared = prepareEmailHtml(html, { reader: true, allowRemote });
		setHasRemote(prepared.hasRemote);
		const base = document.createElement("style");
		// Plain emails follow the app theme, like Gmail. Emails that set their own colors keep
		// a light background so their design stays legible; in dark mode that becomes a card.
		const themed = !emailHasOwnColors(prepared.html);
		const rootStyle = themed
			? "color:var(--color-neutral-900, #202124); background:transparent; color-scheme:light dark;"
			: `color:#202124; background:#fff; color-scheme:light;${dark ? " padding:12px 14px; border-radius:8px;" : ""}`;
		const linkStyle = themed ? `\n${prepared.rootTag} a:link, ${prepared.rootTag} a:visited { color:var(--color-blue-600, #1a73e8); }` : "";
		base.textContent = `${BASE_STYLE}\n${prepared.rootTag} { display:block; font:14px/1.5 Arial,sans-serif; ${rootStyle} }\n${prepared.bodyTag} { display:block; }${linkStyle}`;
		const content = document.createElement("template");
		content.innerHTML = collapseQuotedEmailHtml(prepared.html, preserveLeadingQuote) ?? "";
		root.replaceChildren(base, content.content);
		const mailBody = root.querySelector(prepared.bodyTag);
		// An LTR scroller cannot reach left-side overflow from an RTL email.
		if (mailBody) host.current.dir = window.getComputedStyle(mailBody).direction;
		// Document fragment navigation does not automatically find IDs inside a shadow tree.
		const navigate = (event: Event) => {
			const target = event.target as Element | null;
			const anchor = target?.closest("a[href]");
			const href = anchor?.getAttribute("href");
			if (!href?.startsWith("#")) return;
			event.preventDefault();
			try {
				const id = decodeURIComponent(href.slice(1));
				const destination = root.getElementById(id) ?? Array.from(root.querySelectorAll("a[name]")).find(node => node.getAttribute("name") === id);
				destination?.scrollIntoView({ block: "start" });
			} catch { /* Ignore malformed fragments. */ }
		};
		root.addEventListener("click", navigate);
		return () => root.removeEventListener("click", navigate);
	}, [html, allowRemote, preserveLeadingQuote, dark]);
	return <div className={`min-w-0 max-w-full ${className ?? ""}`}>
		{hasRemote && <div className="mb-2 flex justify-end">
			<button type="button" aria-pressed={allowRemote} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
				onClick={() => setAllowedSource(allowRemote ? null : html)}>
				{allowRemote ? t("message.blockRemote") : t("message.allowRemote")}
			</button>
		</div>}
		<div className="max-w-full overflow-x-auto" ref={host} />
	</div>;
}
