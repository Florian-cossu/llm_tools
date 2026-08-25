import { isStringUsable } from "./string_utils.js";

/**
 * Builds the `q` value for GitHub's issue search endpoint.
 *
 * `is:issue` is what keeps pull requests out of the results, so it is
 * always present: unlike the per-repository issues endpoint, nothing has
 * to be filtered out afterwards and the reported total stays accurate.
 *
 * `state:all` is not a qualifier GitHub understands - asking for both
 * states means leaving the qualifier out.
 */
export function buildIssueSearchQuery({
  owner,
  repository,
  state,
  search,
}: {
  owner: string;
  repository: string;
  state: "open" | "closed" | "all";
  search?: string;
}): string {
  const qualifiers = [`repo:${owner}/${repository}`, "is:issue"];

  if (state !== "all") {
    qualifiers.push(`state:${state}`);
  }

  const terms = search?.trim();
  if (isStringUsable(terms)) {
    qualifiers.push(terms);
  }

  return qualifiers.join(" ");
}
