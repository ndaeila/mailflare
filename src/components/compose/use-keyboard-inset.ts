"use client";

import { useEffect, useState } from "react";

const PHONE_QUERY = "(max-width: 767px)";

export type VisibleViewportBox = {
	/** Distance Safari has scrolled the visible area down from the top of the layout viewport. */
	top: number;
	height: number;
	/** How much of the layout viewport's bottom is covered (keyboard and its bars). */
	bottomInset: number;
};

/**
 * On phones, the part of the screen that is actually visible: above the keyboard and wherever
 * Safari has scrolled to. Undefined on larger screens.
 */
export function useVisibleViewportBox(): VisibleViewportBox | undefined {
	const [box, setBox] = useState<VisibleViewportBox | undefined>(undefined);
	useEffect(() => {
		const viewport = window.visualViewport;
		const query = window.matchMedia(PHONE_QUERY);
		if (!viewport) return;
		const update = () => {
			if (!query.matches) { setBox(undefined); return; }
			const top = Math.round(viewport.offsetTop);
			const height = Math.round(viewport.height);
			setBox({ top, height, bottomInset: Math.max(0, Math.round(window.innerHeight - top - height)) });
		};
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

/** Gap above a phone sheet where the page behind, shrunk back like an iOS card, peeks out. */
export const PHONE_SHEET_GAP = 20;

/**
 * A phone sheet runs to the bottom of the screen, so its white continues under the keyboard and
 * Safari's bars; its content is padded to end where the visible area does.
 */
export function phoneSheetStyle(box: VisibleViewportBox | undefined): React.CSSProperties | undefined {
	return box ? { top: box.top + PHONE_SHEET_GAP, paddingBottom: box.bottomInset } : undefined;
}
