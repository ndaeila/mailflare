"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/client";
import type { ComposeTemplate } from "./template-types";

/** The user's templates, refreshed whenever one is saved elsewhere on the page. */
export function useTemplates(active = true) {
	const [templates, setTemplates] = useState<ComposeTemplate[] | null>(null);
	const [version, setVersion] = useState(0);
	useEffect(() => {
		const bump = () => setVersion((value) => value + 1);
		window.addEventListener("mailflare:templates-changed", bump);
		return () => window.removeEventListener("mailflare:templates-changed", bump);
	}, []);
	useEffect(() => {
		if (!active) return;
		let cancelled = false;
		authFetch("/api/templates", { cache: "no-store" })
			.then(async (response) => (response.ok ? ((await response.json()) as { templates: ComposeTemplate[] }).templates : []))
			.then((list) => { if (!cancelled) setTemplates(list); })
			.catch(() => { if (!cancelled) setTemplates([]); });
		return () => { cancelled = true; };
	}, [active, version]);
	async function remove(id: string) {
		const response = await authFetch(`/api/templates/${id}`, { method: "DELETE" });
		if (response.ok) setTemplates((current) => current?.filter((template) => template.id !== id) ?? null);
	}
	return { templates, remove };
}
