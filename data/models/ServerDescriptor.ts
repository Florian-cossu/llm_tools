export type ServerIconSource = "lucide" | "local";

export type ServerDescriptor = {
  id: number;
  slug: string;
  server_name: string;
  description: string;
  icon_name?: string;
  icon_source?: ServerIconSource;
}

export type ServerRow = {
  id: number;
  slug: string;
  server_name: string;
  description: string;
  icon_name: string | null;
  icon_source: ServerIconSource | null;
};

export function toServerDescriptor(row: ServerRow): ServerDescriptor {
  return {
    id: row.id,
    slug: row.slug,
    server_name: row.server_name,
    description: row.description,
    icon_name: row.icon_name ?? undefined,
    icon_source: row.icon_source ?? undefined,
  };
}