import { isStringUsable } from "@llm-tools/shared";

/**
 * Builds the `q` value for GitHub's issue search endpoint.
 *
 * `is:issue` is what keeps pull requests out of the results, so it is
 * always present: unlike the per-repository issues endpoint, nothing has
 * to be filtered out afterwards and the reported total stays accurate.
 *
 * `state:all` is not a qualifier GitHub understands - asking for both
 * states means leaving the qualifier out.
 *
 * `labels` arrives as one comma-separated string, already stripped of
 * the spaces around its separators, with `NOT:` marking a name to
 * exclude. The two groups become at most two qualifiers, `label:` and
 * `-label:`. Note GitHub reads a comma-separated qualifier as **any of**
 * rather than **all of**: `label:a,b` matches an issue carrying either,
 * and `-label:a,b` drops an issue carrying either. The
 * `list_github_issues` description states that, since the model is the
 * one choosing what to put in the list.
 */
export function buildIssueSearchQuery({
  owner,
  repository,
  state,
  search,
  labels
}: {
  owner: string;
  repository: string;
  state: "open" | "closed" | "all";
  search?: string;
  labels?: string;
}): string {
  const qualifiers = [`repo:${owner}/${repository}`, "is:issue"];

  if (state !== "all") {
    qualifiers.push(`state:${state}`);
  }

  if (isStringUsable(labels)) {
    const exclusionReGex = /^\s*NOT:\s*/i;
    let labelArr = labels.split(",");
    let includeLabel = [];
    let excludeLabel = [];

    for (let label of labelArr) {
      if (exclusionReGex.test(label)) {
        let strippedLabel = label.replace(exclusionReGex,'');
        let cleanedLabel = strippedLabel.includes(" ") ? `"${strippedLabel}"`: strippedLabel;

        excludeLabel.push(cleanedLabel);
      } else {
        let cleanedLabel = label.includes(" ") ? `"${label}"`: label;
        includeLabel.push(cleanedLabel);
      }
    }

    includeLabel.length > 0 ? qualifiers.push(`label:${includeLabel.join(",")}`) : null;
    excludeLabel.length > 0 ? qualifiers.push(`-label:${excludeLabel.join(",")}`) : null;
  }

  const terms = search?.trim();
  if (isStringUsable(terms)) {
    qualifiers.push(terms);
  }

  return qualifiers.join(" ");
}
