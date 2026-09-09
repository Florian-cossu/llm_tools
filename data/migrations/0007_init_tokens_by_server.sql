CREATE TABLE IF NOT EXISTS env (
    id INTEGER PRIMARY KEY,
    server_id INTEGER NOT NULL,
    token_name TEXT NOT NULL,
    type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 0 NOT NULL,
    FOREIGN KEY (server_id) REFERENCES servers(id)
);

CREATE UNIQUE INDEX idx_env_active_per_type
  ON env(server_id, type)
  WHERE is_active = 1;
