CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    server_name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL
);

INSERT INTO
    servers (slug, server_name, description)
VALUES
    (
        'github',
        'GitHub',
        'An MCP server that interacts with the GitHub API to access repositories.'
    );