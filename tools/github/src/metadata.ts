import packageJson from "../package.json" with {
  type: "json",
};

export const APP_NAME = packageJson.name;
export const APP_VERSION = packageJson.version;

export const GITHUB_API_BASE_URL = "https://api.github.com";

export const DEFAULT_ISSUE_STATE = "open" as const;
export const DEFAULT_ISSUE_LIMIT = 30;

export const DEFAULT_MILESTONE_STATE = "open" as const;
export const DEFAULT_MILESTONE_LIMIT = 60;