"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListOrdered, Plus } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { authFetch } from "@/lib/auth/client";
import type { SequenceSummary } from "@/lib/sequences/types";
import { TemplateText } from "./template-text";
import { sequenceSpan, sequenceStats } from "./sequence-ui-utils";

/** Saved sequences as Gmail-style list rows. */
export function SequencesList() {
	const { t } = useLanguage();
	const [sequences, setSequences] = useState<SequenceSummary[] | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		authFetch("/api/sequences")
			.then(async (response) => {
				if (!response.ok) throw new Error("load");
				const data = await response.json() as { sequences: SequenceSummary[] };
				if (!cancelled) setSequences(data.sequences);
			})
			.catch(() => { if (!cancelled) setFailed(true); });
		return () => { cancelled = true; };
	}, []);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4.5 md:px-6">
				<h1 className="text-lg font-normal text-neutral-900">{t("sequences.title")}</h1>
				<Link href="/sequences/new" className="flex h-10 items-center gap-2 rounded-2xl bg-blue-100 px-4 text-sm font-medium text-blue-950 shadow-sm hover:bg-blue-200">
					<Plus className="h-4.5 w-4.5" aria-hidden />
					{t("sequences.newSequence")}
				</Link>
			</div>
			<div role="list" className="min-h-0 flex-1 overflow-y-auto">
				{failed && <p className="p-6 text-sm text-red-600">{t("sequences.loadFailed")}</p>}
				{!failed && sequences === null && <div className="m-6 h-12 animate-pulse rounded-lg bg-neutral-100" />}
				{sequences?.length === 0 && (
					<div className="mx-auto flex max-w-sm flex-col items-center px-6 py-20 text-center">
						<ListOrdered className="h-12 w-12 text-neutral-300" strokeWidth={1.5} aria-hidden />
						<p className="mt-4 text-[15px] text-neutral-900">{t("sequences.empty")}</p>
						<p className="mt-1 text-sm text-neutral-500">{t("sequences.emptyHint")}</p>
					</div>
				)}
				{sequences?.map((sequence) => (
					<div key={sequence.id} role="listitem">
						<Link
							href={`/sequences/${sequence.id}`}
							className="grid border-b border-neutral-100 px-4.5 py-3 text-sm hover:z-10 hover:bg-[#f2f6fc] hover:shadow-sm dark:hover:bg-neutral-100 md:min-h-12 md:grid-cols-[minmax(160px,220px)_minmax(0,1fr)_auto] md:items-center md:gap-4 md:px-6 md:py-0"
						>
							<span className="truncate font-semibold text-neutral-900">{sequence.name}</span>
							<span className="min-w-0 truncate text-neutral-500">
								<span className="text-neutral-700">{sequenceSpan(sequence.steps, t)}</span>
								{" – "}
								<TemplateText text={sequence.steps[0]?.subject ?? ""} tags />
							</span>
							<span className="mt-1 text-xs text-neutral-500 md:mt-0 md:text-sm">{sequenceStats(sequence, t)}</span>
						</Link>
					</div>
				))}
			</div>
		</div>
	);
}
