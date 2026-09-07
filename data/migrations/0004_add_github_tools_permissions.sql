WITH github AS (
    SELECT id FROM servers WHERE slug = 'github'
)

INSERT INTO permissions (server_id, slug, tool_effect, description, state, default_state)
SELECT github.id, 'list_github_issues', 'read', 'Search and list issues in a repository, optionally filtered by label or state.', 'allow', 'allow' FROM github
UNION ALL
SELECT github.id, 'list_github_labels', 'read', 'List a repository''s labels.', 'allow', 'allow' FROM github
UNION ALL
SELECT github.id, 'list_github_milestones', 'read', 'List a repository''s milestones.', 'allow', 'allow' FROM github
UNION ALL
SELECT github.id, 'get_github_issue', 'read', 'Fetch one issue by number.', 'allow', 'allow' FROM github
UNION ALL
SELECT github.id, 'get_github_label', 'read', 'Fetch one label by name.', 'allow', 'allow' FROM github
UNION ALL
SELECT github.id, 'get_github_milestone', 'read', 'Fetch one milestone, including its open/closed issue counts.', 'allow', 'allow' FROM github
UNION ALL
SELECT github.id, 'update_github_label', 'write', 'Rename a label, or change its color or description.', 'deny', 'deny' FROM github
UNION ALL
SELECT github.id, 'update_github_milestone', 'write', 'Rename, redescribe, retarget, or open/close a milestone.', 'deny', 'deny' FROM github
UNION ALL
SELECT github.id, 'update_github_issue', 'write', 'Rename, redescribe, retarget, or open/close an issue.', 'deny', 'deny' FROM github
UNION ALL
SELECT github.id, 'create_github_label', 'write', 'Create a new label.', 'deny', 'deny' FROM github
UNION ALL
SELECT github.id, 'create_github_milestone', 'write', 'Create a new milestone.', 'deny', 'deny' FROM github
UNION ALL
SELECT github.id, 'create_github_issue', 'write', 'Create a new issue.', 'deny', 'deny' FROM github
UNION ALL
SELECT github.id, 'delete_github_milestone', 'destructive', 'Delete a milestone from a repository.', 'deny', 'deny' FROM github
UNION ALL
SELECT github.id, 'delete_github_label', 'destructive', 'Delete a label from a repository.', 'deny', 'deny' FROM github;