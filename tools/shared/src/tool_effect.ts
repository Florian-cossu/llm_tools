/**
 * What a tool does to the system on the other side of the API.
 *
 * Declared per tool rather than inferred, because the caller that has to
 * act on it - `describeMutation`, and the permission table a human edits -
 * cannot tell a mutating endpoint from a reading one by looking at it.
 * See ADR-0007 and ADR-0008.
 */
export type ToolEffect = "read" | "write" | "destructive";

/** The closed set, for validating a stored or user-supplied value. */
export const TOOL_EFFECTS: readonly ToolEffect[] = [
  "read",
  "write",
  "destructive",
] as const;

/**
 * Whether calling the tool changes anything upstream.
 *
 * `read` is the honest default: a tool that declares it and then calls a
 * mutating endpoint is a defect, not a shortcut (ADR-0007 D2). Used to
 * decide what `describeMutation` and the server instructions say about a
 * tool - registration itself is gated solely by the permission table's
 * `state` (ADR-0008), not by effect class.
 */
export function isMutating(effect: ToolEffect): boolean {
  return effect !== "read";
}
