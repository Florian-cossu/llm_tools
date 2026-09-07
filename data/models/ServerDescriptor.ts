export type ServerDescriptor = {
  id: number;
  slug: string;
  server_name: string;
  description: string;
}

export type ServerRow = { id: number; slug: string; server_name: string; description: string };

export function toServerDescriptor(row: ServerRow): ServerDescriptor {
  return {
    id: row.id,
    slug: row.slug,
    server_name: row.server_name,
    description: row.description,
  };
}