ALTER TABLE github_mcp RENAME COLUMN github_mcp_permission to slug;

ALTER TABLE github_mcp ADD server_name TEXT DEFAULT 'github';
ALTER TABLE github_mcp ADD server_effect TEXT NOT NULL DEFAULT 'read' CHECK (server_effect IN ('read', 'write', 'destructive'));
ALTER TABLE github_mcp ADD summary TEXT DEFAULT NULL;
ALTER TABLE github_mcp ADD known_defects TEXT DEFAULT NULL;
ALTER TABLE github_mcp ADD default_state TEXT NOT NULL DEFAULT 'deny' CHECK (default_state IN ('allow', 'deny', 'ask'));

UPDATE github_mcp
SET server_effect = 'read', summary = 'Search and list issues in a repository, optionally filtered by label or state.', default_state='allow', known_defects=null
WHERE slug = 'list_github_issues';

UPDATE github_mcp
SET server_effect = 'read', summary = 'List a repository''s labels.', default_state='allow', known_defects=null
WHERE slug = 'list_github_labels';

UPDATE github_mcp
SET server_effect = 'read', summary = 'List a repository''s milestones.', default_state='allow', known_defects=null
WHERE slug = 'list_github_milestones';

UPDATE github_mcp
SET server_effect = 'read', summary = 'Fetch one issue by number.', default_state='allow', known_defects=null
WHERE slug = 'get_github_issue';

UPDATE github_mcp
SET server_effect = 'read', summary = 'Fetch one label by name.', default_state='allow', known_defects=null
WHERE slug = 'get_github_label';

UPDATE github_mcp
SET server_effect = 'read', summary = 'Fetch one milestone, including its open/closed issue counts.', default_state='allow', known_defects=null
WHERE slug = 'get_github_milestone';

UPDATE github_mcp
SET server_effect = 'write', summary = 'Rename a label, or change its color or description.', default_state='deny', known_defects=null
WHERE slug = 'update_github_label';

UPDATE github_mcp
SET server_effect = 'write', summary = 'Rename, redescribe, retarget, or open/close a milestone.', default_state='deny', known_defects=null
WHERE slug = 'update_github_milestone';


UPDATE github_mcp
SET server_effect = 'write', summary = 'Create a new label.', default_state='deny', known_defects=null
WHERE slug = 'create_github_label';

UPDATE github_mcp
SET server_effect = 'destructive', summary = 'Delete a label from a repository.', default_state='deny', known_defects=null
WHERE slug = 'delete_github_label';