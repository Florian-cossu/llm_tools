import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

import { blankToNull } from "./utils/string_utils.js";

/**
 * Values read from the `.env` file next to the server package.
 *
 * Every field is nullable: without a token the server reads public
 * repositories anonymously, and without defaults the caller has to pass
 * the target repository on every tool call.
 */
export type ServerConfig = {
  /** Personal access token, or null to call the GitHub API anonymously. */
  token: string | null;
  /** Login substituted for the "@me" assignee sentinel. */
  defaultUsername: string | null;
  /** Repository owner used when a tool call omits it. */
  defaultOwner: string | null;
  /** Repository name used when a tool call omits it. */
  defaultRepository: string | null;
};

/**
 * Loads the `.env` file and returns the configuration it declares.
 *
 * Call this once, at startup, before registering any tool: tools receive
 * the result rather than reading `process.env` themselves, so that no
 * module can accidentally read the environment before it is populated.
 */
export function loadConfig(): ServerConfig {
  // `quiet` matters: dotenv otherwise prints a summary banner on stdout,
  // which corrupts the JSON-RPC stream the stdio transport speaks.
  dotenv.config({
    path: fileURLToPath(new URL("../.env", import.meta.url)),
    quiet: true,
  });

  return {
    token: blankToNull(process.env.GITHUB_TOKEN),
    defaultUsername: blankToNull(process.env.GITHUB_DEFAULT_USERNAME),
    defaultOwner: blankToNull(process.env.GITHUB_DEFAULT_OWNER),
    defaultRepository: blankToNull(process.env.GITHUB_DEFAULT_REPOSITORY),
  };
}
