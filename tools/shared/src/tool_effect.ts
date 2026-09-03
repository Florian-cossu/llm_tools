/**
 * What a tool does to the system on the other side of the API.
 *
 * Declared per tool rather than inferred, because the caller that has to
 * act on it - the registration gate today, the permission layer later -
 * cannot tell a mutating endpoint from a reading one by looking at it.
 * See ADR-0007.
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
 * mutating endpoint is a defect, not a shortcut (ADR-0007 D2).
 */
export function isMutating(effect: ToolEffect): boolean {
  return effect !== "read";
}

/**
 * Why a tool may not be registered, or `null` when it may.
 *
 * The gate is at **registration**, not inside the handler: a tool the
 * user has not enabled is never registered, so the model never sees a
 * capability it must not use, rather than seeing one and being asked not
 * to call it (ADR-0007 D4).
 *
 * `destructive` is refused whatever the flag says. Irreversible removal
 * waits for the permission layer, because an `.env` boolean is too
 * coarse a consent for an action with no compensating one (ADR-0007 D3).
 */
export function registrationRefusal(
  effect: ToolEffect,
  allowWrites: boolean,
): string | null {
  if (effect === "destructive") {
    return `declares the "destructive" effect, which no tool may be ` +
      `registered with yet - see ADR-0007`;
  }

  if (isMutating(effect) && !allowWrites) {
    return `declares the "${effect}" effect and writes are disabled on ` +
      `this server`;
  }

  return null;
}

/**
 * Reads a boolean out of the environment.
 *
 * Opt-in, and deliberately strict about what counts as one: anything
 * other than an explicit affirmative leaves the capability off, so a
 * typo fails closed rather than enabling writes.
 */
export function booleanFromEnv(value: string | undefined | null): boolean {
  if (value === undefined || value === null) return false;

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}
