import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

const server = new McpServer({
  name: "github-issues-manager",
  version: "1.0.0",
});

server.registerTool(
  "list_github_issues",
  {
    description: "List GitHub issues for a repository",
    inputSchema: z.object({
      owner: z.string().describe("GitHub repository owner"),
      repository: z.string().describe("GitHub repository name"),
    }),
  },
  async ({ owner, repository }) => {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repository}/issues`,
    );

    const issues = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            owner,
            repository,
            issues,
          }),
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
