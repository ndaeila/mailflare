"use client";

import { useEffect, useState } from "react";

/** Height the on-screen keyboard covers at the bottom of the layout viewport (0 without one). */
export function useKeyboardInset(active: boolean): number {
	const [inset, setInset] = useState(0);
	useEffect(() => {
		const viewport = typeof window === "undefined" ? null : window.visualViewport;
		if (!active || !viewport) return;
		const update = () => setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
		update();
		viewport.addEventListener("resize", update);
		viewport.addEventListener("scroll", update);
		return () => {
			viewport.removeEventListener("resize", update);
			viewport.removeEventListener("scroll", update);
		};
	}, [active]);
	return active ? inset : 0;
}
