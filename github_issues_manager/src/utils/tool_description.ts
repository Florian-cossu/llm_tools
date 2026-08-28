import z from "zod";

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

/**
 * States, for a tool description, that the repository is already known.
 *
 * The per-parameter `describeDefault` text says the same thing, but it
 * sits inside the schema and is only read once the model has decided to
 * call the tool. A model deciding whether it can answer at all reads the
 * tool description, so the fallback has to be stated there too or it
 * asks the user for values it already has.
 *
 * Returns an empty string when nothing is configured, so that a server
 * without defaults does not promise one.
 */
export function describeConfiguredRepository(
  owner: string | null,
  repository: string | null,
): string {
  return owner !== null && repository !== null
    ? `This server is already configured for ${owner}/${repository}: omit ` +
        `"owner" and "repository" unless the user explicitly names a ` +
        `different repository, and never ask the user for them. `
    : "";
}

/**
 * A string parameter that is optional only when a fallback is configured.
 *
 * The schema a model sees carries more weight than the prose next to it,
 * so a parameter `describeDefault` calls required has to be required in
 * the schema too, rather than optional everywhere and rejected at call
 * time.
 */
export function optionalWhenConfigured(
  configured: string | null,
): z.ZodString | z.ZodOptional<z.ZodString> {
  return configured === null ? z.string() : z.string().optional();
}