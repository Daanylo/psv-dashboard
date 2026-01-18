
-- 1. Add brand_id column to logo_detections if it doesn't exist
-- Note: MySQL 8.0 support 'IF NOT EXISTS' for columns in ALTER TABLE, 
-- but simpler safe way is to wrap in a stored procedure or ignore error if it exists.
-- For this script, we assume run manually or compatible environment.
-- Or we just run the ADD COLUMN line, if it fails it fails.
ALTER TABLE logo_detections ADD COLUMN brand_id INT NULL;
ALTER TABLE logo_detections ADD CONSTRAINT fk_logo_detections_brand_id FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL;

-- 2. Insert missing brands from logo_detections into brands table
-- We assume the logo_label relates to the brand name/slug
INSERT INTO brands (name, slug, color, match_keywords)
SELECT DISTINCT 
    TRIM(BOTH '\r' FROM logo_label) as name, 
    LOWER(REGEXP_REPLACE(TRIM(BOTH '\r' FROM logo_label), '[^a-zA-Z0-9]', '')) as slug,
    '#000000' as color, -- Default color black
    TRIM(BOTH '\r' FROM logo_label) as match_keywords
FROM logo_detections
WHERE 
    TRIM(BOTH '\r' FROM logo_label) NOT LIKE 'psv'
    AND LOWER(REGEXP_REPLACE(TRIM(BOTH '\r' FROM logo_label), '[^a-zA-Z0-9]', '')) NOT IN (SELECT slug FROM brands);

-- 3. Link logo_detections to brands
UPDATE logo_detections ld
JOIN brands b ON 
    TRIM(BOTH '\r' FROM ld.logo_label) LIKE b.match_keywords -- Simple match
    OR LOWER(TRIM(BOTH '\r' FROM ld.logo_label)) = b.slug -- Exact slug match
    OR b.match_keywords LIKE CONCAT('%', TRIM(BOTH '\r' FROM ld.logo_label), '%') -- Partial keyword match
SET ld.brand_id = b.id
WHERE ld.brand_id IS NULL;
