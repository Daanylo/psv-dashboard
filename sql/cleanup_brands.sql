-- Cleanup Brands Script

-- 1. Merge duplicates
-- '50plus-mobiel' (id 8) should be merged into '50+ Mobiel' (id 7)
-- First, update detections that might have been linked to the duplicate
UPDATE logo_detections SET brand_id = 7 WHERE brand_id = 8;
-- Update keywords for the main brand to include the duplicate's slug/keywords if not present
UPDATE brands 
SET match_keywords = CONCAT(match_keywords, ', 50plus-mobiel') 
WHERE id = 7 AND match_keywords NOT LIKE '%50plus-mobiel%';
-- Delete the duplicate brand
DELETE FROM brands WHERE id = 8;

-- 2. Remove unwanted brands (Ziggo, Ajax, Adidas)
-- Unlink detections first (sets brand_id to NULL due to FK)
UPDATE logo_detections SET brand_id = NULL WHERE brand_id IN (9, 10, 20);
DELETE FROM brands WHERE id IN (9, 10, 20);
-- Also delete by slug just in case IDs vary
DELETE FROM brands WHERE slug IN ('adidas', 'ajax', 'ziggo');

-- 3. Fix Casing and Names
UPDATE brands SET name = 'Crowe' WHERE slug = 'crowe';
UPDATE brands SET name = 'iFOREX' WHERE slug = 'iforex';
UPDATE brands SET name = 'Markteffect' WHERE slug = 'markteffect';
UPDATE brands SET name = 'Philips' WHERE slug = 'philips';
UPDATE brands SET name = 'Pipple' WHERE slug = 'pipple';
UPDATE brands SET name = 'PSV Play' WHERE slug = 'psvplay'; -- or 'psv-play' if slug was cleaned
UPDATE brands SET name = 'The Athletes Foodcoach' WHERE slug = 'theathletesfoodcoach';
UPDATE brands SET name = 'Umbro' WHERE slug = 'umbro';
UPDATE brands SET name = 'VriendenLoterij' WHERE slug = 'vriendenloterij';

-- 4. Re-link any unlinked detections (in case new detections came in or were unlinked)
UPDATE logo_detections ld
JOIN brands b ON 
   (TRIM(BOTH '\r' FROM ld.logo_label) = b.name)
   OR (LOWER(TRIM(BOTH '\r' FROM ld.logo_label)) = b.slug)
   OR (b.match_keywords LIKE CONCAT('%', TRIM(BOTH '\r' FROM ld.logo_label), '%'))
SET ld.brand_id = b.id
WHERE ld.brand_id IS NULL;
