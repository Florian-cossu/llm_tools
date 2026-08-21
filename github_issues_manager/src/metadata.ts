import packageJson from "../package.json" with {
  type: "json",
};

export const APP_NAME = packageJson.name;
export const APP_VERSION = packageJson.version;

export const GITHUB_API_BASE_URL = "https://api.github.com";

export const DEFAULT_ISSUE_STATE = "open" as const;
export const DEFAULT_ISSUE_LIMIT = 30;

/**
 * Sentinel the model passes in `assignee` when the user refers to
 * themselves ("my issues", "assigned to me"). Resolved server-side to
 * GITHUB_DEFAULT_USERNAME.
 */
export const CURRENT_USER_SENTINEL = "@me";

/** GitHub sentinel: issues with no assignee at all. */
export const NO_ASSIGNEE_SENTINEL = "none";

/** GitHub sentinel: issues assigned to anyone. */
export const ANY_ASSIGNEE_SENTINEL = "*";
