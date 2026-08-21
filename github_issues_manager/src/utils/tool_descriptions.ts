/**
 * Describes a parameter that falls back to a value from the `.env` file.
 *
 * The configured value is interpolated into the description so the model
 * can see what will be used, and therefore has no reason to ask the user
 * for it. When nothing is configured, the model is told the parameter is
 * required instead.
 */
export function describeDefault(
  configured: string | null,
  whenMissing: string,
): string {
  return configured === null
    ? whenMissing
    : `Defaults to the configured value (${configured}) when omitted.`;
}
