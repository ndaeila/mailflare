"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronRight, ListOrdered, Settings2 } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { authFetch } from "@/lib/auth/client";
import type { SequenceSummary } from "@/lib/sequences/types";
import { followUpSummary } from "./sequence-ui-utils";

const itemClass = "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-neutral-900 outline-none hover:bg-neutral-100 focus:bg-neutral-100 data-[highlighted]:bg-neutral-100 data-[disabled]:cursor-default data-[disabled]:opacity-60";

function useSequenceList(active: boolean) {
	const [sequences, setSequences] = useState<SequenceSummary[] | null>(null);
	useEffect(() => {
		if (!active) return;
		let cancelled = false;
		authFetch("/api/sequences")
			.then(async (response) => (response.ok ? (await response.json() as { sequences: SequenceSummary[] }).sequences : []))
			.then((list) => { if (!cancelled) setSequences(list); })
			.catch(() => { if (!cancelled) setSequences([]); });
		return () => { cancelled = true; };
	}, [active]);
	return sequences;
}

const finePointerQuery = "(hover: hover) and (pointer: fine)";
function subscribePointer(onChange: () => void) {
	const query = window.matchMedia(finePointerQuery);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

/** Desktop gets a flyout submenu; touch screens get a bottom sheet, as Gmail does on phones. */
export function useFinePointer(): boolean {
	return useSyncExternalStore(subscribePointer, () => window.matchMedia(finePointerQuery).matches, () => true);
}

/** ⋯ → Sequences ▸, like Gmail's Templates submenu. Picking one never changes the draft.
 * On touch screens it is a plain item that opens SequencesSheet instead. */
export function SequencesSubmenu({ onPick, onOpenSheet, disabled }: { onPick: (sequence: SequenceSummary) => void; onOpenSheet: () => void; disabled?: boolean }) {
	const { t } = useLanguage();
	const router = useRouter();
	const finePointer = useFinePointer();
	const sequences = useSequenceList(finePointer);

	if (!finePointer) {
		return (
			<DropdownMenu.Item disabled={disabled} onSelect={onOpenSheet} className={itemClass}>
				<ListOrdered className="h-5 w-5" />
				<span className="flex-1">{t("sequences.title")}</span>
				<ChevronRight className="h-4 w-4 text-neutral-500" />
			</DropdownMenu.Item>
		);
	}

	return (
		<DropdownMenu.Sub>
			<DropdownMenu.SubTrigger disabled={disabled} className={`${itemClass} data-[state=open]:bg-neutral-100`}>
				<ListOrdered className="h-5 w-5" />
				<span className="flex-1">{t("sequences.title")}</span>
				<ChevronRight className="h-4 w-4 text-neutral-500" />
			</DropdownMenu.SubTrigger>
			<DropdownMenu.Portal>
				<DropdownMenu.SubContent sideOffset={4} collisionPadding={8} className="z-50 max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] w-72 max-w-[calc(100vw-16px)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-1.5 text-[15px] shadow-xl">
					{sequences === null && <div className="m-2 h-12 animate-pulse rounded-xl bg-neutral-100" />}
					{sequences?.length === 0 && (
						<DropdownMenu.Item disabled className={itemClass}>
							<span className="text-sm text-neutral-500">{t("sequences.empty")}</span>
						</DropdownMenu.Item>
					)}
					{sequences?.map((sequence) => (
						<DropdownMenu.Item key={sequence.id} onSelect={() => onPick(sequence)} className={`${itemClass} items-start`}>
							<span className="min-w-0 flex-1">
								<span className="block truncate">{sequence.name}</span>
								<span className="block truncate text-xs text-neutral-500">{followUpSummary(sequence.steps, t)}</span>
							</span>
						</DropdownMenu.Item>
					))}
					<DropdownMenu.Separator className="my-1 h-px bg-neutral-200" />
					<DropdownMenu.Item onSelect={() => router.push(sequences?.length ? "/sequences" : "/sequences/new")} className={itemClass}>
						<Settings2 className="h-4 w-4 text-neutral-600" />
						<span className="text-sm">{sequences?.length ? t("sequences.manage") : t("sequences.create")}</span>
					</DropdownMenu.Item>
					{!!sequences?.length && <p className="px-3 pb-1.5 pt-1 text-xs text-neutral-500">{t("sequences.draftStays")}</p>}
				</DropdownMenu.SubContent>
			</DropdownMenu.Portal>
		</DropdownMenu.Sub>
	);
}

/** Bottom sheet listing sequences, for touch screens. */
export function SequencesSheet({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (open: boolean) => void; onPick: (sequence: SequenceSummary) => void }) {
	const { t } = useLanguage();
	const sequences = useSequenceList(open);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				closeClassName="hidden"
				onOpenAutoFocus={(event) => event.preventDefault()}
				className="bottom-0 top-auto max-h-[80dvh] w-full max-w-none translate-y-0 overflow-y-auto rounded-b-none rounded-t-[28px] px-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:bottom-auto sm:top-1/2 sm:w-[min(420px,calc(100vw-32px))] sm:-translate-y-1/2 sm:rounded-[28px]"
			>
				<div className="mx-auto mb-2 h-1 w-8 rounded-full bg-neutral-300 sm:hidden" aria-hidden />
				<DialogTitle className="px-6 pb-2 pt-2 text-xl font-normal">{t("sequences.title")}</DialogTitle>
				{sequences === null && <div className="mx-6 my-2 h-12 animate-pulse rounded-xl bg-neutral-100" />}
				{sequences?.length === 0 && <p className="px-6 py-3 text-sm text-neutral-500">{t("sequences.empty")}</p>}
				<div role="list">
					{sequences?.map((sequence) => (
						<button key={sequence.id} type="button" role="listitem" onClick={() => { onOpenChange(false); onPick(sequence); }} className="flex w-full items-center gap-4 px-6 py-3 text-left hover:bg-neutral-100 active:bg-neutral-200">
							<ListOrdered className="h-5 w-5 shrink-0 text-neutral-600" aria-hidden />
							<span className="min-w-0 flex-1">
								<span className="block truncate text-base text-neutral-900">{sequence.name}</span>
								<span className="block truncate text-sm text-neutral-500">{followUpSummary(sequence.steps, t)}</span>
							</span>
						</button>
					))}
				</div>
				<div className="mt-1 border-t border-neutral-200 px-6 pt-3">
					<Link href={sequences?.length ? "/sequences" : "/sequences/new"} onClick={() => onOpenChange(false)} className="flex items-center gap-4 py-2 text-sm font-medium text-blue-700">
						<Settings2 className="h-5 w-5" aria-hidden />
						{sequences?.length ? t("sequences.manage") : t("sequences.create")}
					</Link>
					{!!sequences?.length && <p className="pb-1 pt-1 text-xs text-neutral-500">{t("sequences.draftStays")}</p>}
				</div>
			</DialogContent>
		</Dialog>
	);
}
