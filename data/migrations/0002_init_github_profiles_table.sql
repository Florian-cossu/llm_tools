CREATE TABLE IF NOT EXISTS github_profiles (
    id INTEGER PRIMARY KEY,
    server_id INTEGER NOT NULL,
    profile_name TEXT NOT NULL UNIQUE,
    repository_owner TEXT NOT NULL,
    repository_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 0 NOT NULL,
    FOREIGN KEY (server_id) REFERENCES servers(id)
);