CREATE TABLE IF NOT EXISTS github_mcp (
    github_mcp_permission TEXT NOT NULL PRIMARY KEY,
    state TEXT NOT NULL DEFAULT 'deny' CHECK (state IN ('allow', 'deny', 'ask'))
);

INSERT INTO github_mcp
    (github_mcp_permission, state)
VALUES
    ('list_github_issues', 'allow'),
    ('list_github_milestones', 'allow'),
    ('list_github_labels', 'allow'),
    ('get_github_issue', 'allow'),
    ('get_github_milestone', 'allow'),
    ('get_github_label', 'allow'),
    ('create_github_label', 'deny'),
    ('update_github_label', 'deny'),
    ('delete_github_label', 'deny');