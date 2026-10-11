import type { Viewport } from "next";

/** iPhone, iPad and iPod browsers (every iOS browser is WebKit and zooms the same way). */
export function isIosUserAgent(userAgent: string | null | undefined): boolean {
	return /\b(iPhone|iPad|iPod)\b/.test(userAgent ?? "");
}

/**
 * iOS zooms into any text field under 16px when it gains focus. maximum-scale=1 stops that
 * auto-zoom, and since iOS 10 Safari ignores it for pinch-to-zoom, so people can still zoom.
 * Other browsers do not auto-zoom but would honour it against pinching, so they don't get it.
 */
export function viewportForUserAgent(userAgent: string | null | undefined): Viewport {
	return isIosUserAgent(userAgent)
		? { width: "device-width", initialScale: 1, maximumScale: 1 }
		: { width: "device-width", initialScale: 1 };
}
