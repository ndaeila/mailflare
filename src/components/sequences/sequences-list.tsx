"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { authFetch } from "@/lib/auth/client";
import type { SequenceSummary } from "@/lib/sequences/types";
import { sequenceListMeta } from "./sequence-ui-utils";

/** Saved sequences with how each is doing. */
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
			<div className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 px-4.5 md:px-6">
				<h1 className="text-[22px] font-semibold text-neutral-900">{t("sequences.title")}</h1>
				<Link href="/sequences/new" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[15px] font-medium text-blue-600 hover:bg-blue-50">
					<Plus className="h-4.5 w-4.5" aria-hidden />
					{t("sequences.new")}
				</Link>
			</div>
			<div role="list" className="min-h-0 flex-1 overflow-y-auto">
				{failed && <p className="p-6 text-sm text-red-600">{t("sequences.loadFailed")}</p>}
				{!failed && sequences === null && <div className="m-6 h-24 animate-pulse rounded-xl bg-neutral-100" />}
				{sequences?.length === 0 && (
					<div className="mx-auto max-w-md px-6 py-16 text-center">
						<p className="text-lg font-semibold text-neutral-900">{t("sequences.empty")}</p>
						<p className="mt-2 text-sm text-neutral-600">{t("sequences.emptyHint")}</p>
						<Link href="/sequences/new" className="mt-5 inline-flex rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">{t("sequences.create")}</Link>
					</div>
				)}
				{sequences?.map((sequence) => {
					const { active, replied, finished, total } = sequence.stats;
					const rate = total ? Math.round((replied / total) * 100) : null;
					return (
						<div key={sequence.id} role="listitem"><Link href={`/sequences/${sequence.id}`} className="block border-b border-neutral-100 px-4.5 py-4 hover:bg-[#f2f6fc] md:px-6">
							<span className="block text-[16px] font-semibold text-neutral-900">{sequence.name}</span>
							<span className="mt-0.5 block text-sm text-neutral-500">{sequenceListMeta(sequence, t)}</span>
							<span className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
								<span className="text-neutral-900"><b className="font-semibold">{active}</b> <span className="text-neutral-500">{t("sequences.status.active").toLowerCase()}</span></span>
								<span className="text-neutral-900"><b className="font-semibold">{replied}</b> <span className="text-neutral-500">{t("sequences.status.replied").toLowerCase()}</span></span>
								<span className="text-neutral-500">{rate === null ? "–" : t("sequences.replyRate", { rate })}</span>
								<span className="text-neutral-900"><b className="font-semibold">{finished}</b> <span className="text-neutral-500">{t("sequences.status.finished").toLowerCase()}</span></span>
							</span>
						</Link></div>
					);
				})}
			</div>
		</div>
	);
}
