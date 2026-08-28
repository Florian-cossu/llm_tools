import { ServerConfig } from "./index.js";

/**
 * Guidance handed to the client at initialisation.
 *
 * Tool descriptions are only consulted once a model has decided to reach
 * for a tool. A model deciding whether it has enough information to
 * answer at all reads the system prompt, which is where clients put
 * these instructions - so anything meant to stop the model interrogating
 * the user about values the server already holds belongs here rather
 * than, or as well as, in a tool description.
 */
export function buildServerInstructions(config: ServerConfig): string {
  const paragraphs: string[] = [];

  if (config.defaultOwner !== null && config.defaultRepository !== null) {
    paragraphs.push(
      `This server reads GitHub issues from ` +
        `${config.defaultOwner}/${config.defaultRepository}. Its tools ` +
        `fill in the owner and repository themselves, so call them ` +
        `without those parameters and never ask the user which ` +
        `repository is meant. Pass them only when the user explicitly ` +
        `names a different repository.`,
    );
  }

  if (config.defaultUsername !== null) {
    paragraphs.push(
      `The user of this server is ${config.defaultUsername}. Read "my ` +
        `issues", "issues assigned to me" and similar as issues assigned ` +
        `to that account: pass "assignee:@me" to the search parameter of ` +
        `list_github_issues, which GitHub resolves against it. Use ` +
        `"author:@me" for issues they opened.`,
    );
  }

  // paragraphs.push(
  //   `These tools are read-only: they never create, edit or close ` +
  //     `anything, so they can be called without confirming with the user ` +
  //     `first.`,
  // );

  return paragraphs.join("\n\n");
}
