import type { ServerConfig } from "../config.js";
import { GITHUB_API_BASE_URL } from "../metadata.js";

/**
 * Calls a GitHub REST endpoint and returns its parsed JSON body.
 *
 * @param path Endpoint path with a leading slash, for example
 *   `/repos/octocat/hello-world/issues`. Path segments that come from tool
 *   arguments must already be URL-encoded by the caller.
 * @param query Query parameters to append.
 */
export async function githubRequest<T>(
  config: ServerConfig,
  path: string,
  query: URLSearchParams,
): Promise<T> {
  const url = `${GITHUB_API_BASE_URL}${path}?${query}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(config.token
        ? {
            Authorization: `Bearer ${config.token}`,
          }
        : {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();

    throw new Error(
      `GitHub API error: ${response.status}\n` +
        `URL: ${url}\n` +
        `Response: ${errorBody}`,
    );
  }

  return (await response.json()) as T;
}
