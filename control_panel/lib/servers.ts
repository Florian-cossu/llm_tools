export type ServerDescriptor = {
  slug: "github";
  label: string;
};

/** Every MCP server this repo ships. One entry each, added alongside its tools in lib/tools.ts. */
export const SERVERS: ServerDescriptor[] = [{ slug: "github", label: "GitHub" }];

export function findServer(slug: string): ServerDescriptor | undefined {
  return SERVERS.find((server) => server.slug === slug);
}
