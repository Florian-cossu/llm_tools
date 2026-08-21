import type { ServerConfig } from "../config.js";
import { CURRENT_USER_SENTINEL } from "../metadata.js";
import { blankToNull } from "../utils/string_utils.js";

/** A repository a tool call targets, ready to be put in a URL path. */
export type RepositoryTarget = {
  owner: string;
  repository: string;
  /** `owner/repository`, for echoing back in tool results. */
  slug: string;
  /** URL-encoded path prefix, for example `/repos/octocat/hello-world`. */
  path: string;
};

/**
 * Resolves the owner and repository a tool call targets, falling back to
 * the configured defaults, and throws a message the model can act on when
 * neither is available.
 */
export function resolveRepositoryTarget(
  config: ServerConfig,
  owner: string | undefined,
  repository: string | undefined,
): RepositoryTarget {
  const resolvedOwner = blankToNull(owner) ?? config.defaultOwner;
  const resolvedRepository =
    blankToNull(repository) ?? config.defaultRepository;

  if (resolvedOwner === null || resolvedRepository === null) {
    throw new Error(
      "No GitHub owner or repository was provided, and no default was " +
        "configured. Set GITHUB_DEFAULT_OWNER and " +
        "GITHUB_DEFAULT_REPOSITORY in the server .env file, or pass both " +
        "as arguments.",
    );
  }

  const encodedOwner = encodeURIComponent(resolvedOwner);
  const encodedRepository = encodeURIComponent(resolvedRepository);

  return {
    owner: resolvedOwner,
    repository: resolvedRepository,
    slug: `${resolvedOwner}/${resolvedRepository}`,
    path: `/repos/${encodedOwner}/${encodedRepository}`,
  };
}

/**
 * Resolves the `assignee` argument into the single value the GitHub REST
 * API expects, or null when the results should not be filtered by
 * assignee.
 *
 * The GitHub issues endpoint accepts exactly one assignee: a login, the
 * literal `none`, or the literal `*`. A comma-separated list and an empty
 * string both fail with a 422, so the parameter must be omitted entirely
 * rather than sent blank.
 */
export function resolveAssignee(
  config: ServerConfig,
  assignee: string | undefined,
): string | null {
  const requested = blankToNull(assignee);

  if (requested === null) {
    return null;
  }

  if (requested !== CURRENT_USER_SENTINEL) {
    return requested;
  }

  if (config.defaultUsername === null) {
    throw new Error(
      `Cannot resolve "${CURRENT_USER_SENTINEL}": no ` +
        `GITHUB_DEFAULT_USERNAME is configured. Ask the user for their ` +
        `GitHub login and pass it as the assignee instead.`,
    );
  }

  return config.defaultUsername;
}
