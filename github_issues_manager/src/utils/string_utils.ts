export function isStringUnusable(
  str: string | null | undefined,
): str is null | undefined | "" {
  return str == null || str == undefined || str === "";
}

export function isStringUsable(
  str: string | null | undefined,
): str is string {
  return str != null && str != undefined && str !== "";
}

export function stringOrNull(str: string | null | undefined): string | null {
    return isStringUsable(str) ? str.trim() : null;
}