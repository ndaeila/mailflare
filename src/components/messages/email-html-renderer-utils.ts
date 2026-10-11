// Matches colors an email sets for itself: inline or <style> color/background
// declarations, legacy bgcolor/text attributes and <font color>. `border-color`
// and similar compound properties are deliberately not matched.
const OWN_COLOR_PATTERN = /\bbgcolor\s*=|\btext\s*=\s*["']?#|<font\b[^>]*\bcolor\s*=|background(?:-color|-image)?\s*:|(?:^|[\s;"'{])color\s*:/i;

/** True when the email styles its own colors, so it should keep a light "paper"
 * background instead of following the app theme. Plain emails (most personal
 * mail and everything written in the composer) return false. */
export function emailHasOwnColors(html: string): boolean {
	return OWN_COLOR_PATTERN.test(html);
}

export function isDarkTheme(): boolean {
	return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

/** useSyncExternalStore subscriber for the .dark class on <html>. */
export function subscribeToTheme(onChange: () => void): () => void {
	const observer = new MutationObserver(onChange);
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	return () => observer.disconnect();
}
