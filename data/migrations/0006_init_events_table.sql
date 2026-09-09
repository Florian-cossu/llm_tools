CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY,
  server_id   INTEGER NOT NULL,
  session_id  TEXT,
  tool_id     INTEGER,
  status      TEXT NOT NULL DEFAULT 'success'
              CHECK(status IN ('success', 'error')),
  error_message TEXT,
  duration_ms INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tool_id) REFERENCES permissions(id),
  FOREIGN KEY (server_id) REFERENCES servers(id)
);

CREATE INDEX IF NOT EXISTS idx_events_server_id  ON events(server_id);
CREATE INDEX IF NOT EXISTS idx_events_tool_id  ON events(tool_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);