/**
 * True when the value is null, undefined, or contains only whitespace.
 */
export function isBlank(str: string | null | undefined): boolean {
    return str == null || str.trim() === "";
}

/**
 * Trimmed value, or null when the value is blank.
 */
export function blankToNull(str: string | null | undefined): string | null {
    return isBlank(str) ? null : str!.trim();
}
