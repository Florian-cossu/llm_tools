ALTER TABLE servers ADD COLUMN icon_name TEXT;

ALTER TABLE servers ADD COLUMN icon_source TEXT CHECK(icon_source IN ('lucide', 'local'));

UPDATE servers
SET icon_name = 'github', icon_source = 'local'
WHERE slug = 'github';