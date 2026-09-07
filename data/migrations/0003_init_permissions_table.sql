CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY,
    server_id INTEGER NOT NULL,
    slug TEXT NOT NULL,
    tool_effect TEXT NOT NULL DEFAULT 'read' CHECK (tool_effect IN ('read', 'write', 'destructive')),
    description TEXT DEFAULT NULL,
    state TEXT NOT NULL DEFAULT 'deny' CHECK (state IN ('allow', 'deny', 'ask')),
    default_state TEXT NOT NULL DEFAULT 'deny' CHECK (default_state IN ('allow', 'deny', 'ask')),
    FOREIGN KEY (server_id) REFERENCES servers(id),
    UNIQUE (server_id, slug)
);