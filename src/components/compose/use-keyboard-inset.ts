"use client";

import { useEffect, useState } from "react";

const PHONE_QUERY = "(max-width: 767px)";

/**
 * On phones, the box of the screen that is actually visible: above the keyboard and wherever
 * Safari has scrolled to. A full-screen composer pinned to this box keeps its top bar in view
 * while typing, instead of being pushed up off the screen. Undefined on larger screens.
 */
export function useVisibleViewportBox(): { top: number; height: number } | undefined {
	const [box, setBox] = useState<{ top: number; height: number } | undefined>(undefined);
	useEffect(() => {
		const viewport = window.visualViewport;
		const query = window.matchMedia(PHONE_QUERY);
		if (!viewport) return;
		const update = () => setBox(query.matches ? { top: Math.round(viewport.offsetTop), height: Math.round(viewport.height) } : undefined);
		update();
		viewport.addEventListener("resize", update);
		viewport.addEventListener("scroll", update);
		query.addEventListener("change", update);
		return () => {
			viewport.removeEventListener("resize", update);
			viewport.removeEventListener("scroll", update);
			query.removeEventListener("change", update);
		};
	}, []);
	return box;
}

/** Gap above a phone sheet, so the page behind peeks out like iOS stacked cards (Gmail's compose). */
export const PHONE_SHEET_GAP = 12;

/** Style that pins a phone sheet to the visible box, leaving the stacked-card gap at the top. */
export function phoneSheetStyle(box: { top: number; height: number } | undefined): React.CSSProperties | undefined {
	return box ? { top: box.top + PHONE_SHEET_GAP, height: box.height - PHONE_SHEET_GAP } : undefined;
}
