
-- Add columns if they don't exist
ALTER TABLE brands ADD COLUMN logo_light VARCHAR(255) DEFAULT NULL;
ALTER TABLE brands ADD COLUMN logo_dark VARCHAR(255) DEFAULT NULL;

-- Update existing logos based on file availability
UPDATE brands SET logo_light = '/sponsor-logos/puma-black.svg', logo_dark = '/sponsor-logos/puma-white.png' WHERE slug = 'puma';
UPDATE brands SET logo_light = '/sponsor-logos/brainport-black.png', logo_dark = '/sponsor-logos/brainport-white.png' WHERE slug = 'brainport';
UPDATE brands SET logo_light = '/sponsor-logos/energiedirect.png', logo_dark = '/sponsor-logos/energiedirect.png' WHERE slug = 'energiedirect';
UPDATE brands SET logo_light = '/sponsor-logos/simac.gif', logo_dark = '/sponsor-logos/simac.gif' WHERE slug = 'simac';
UPDATE brands SET logo_light = '/sponsor-logos/goodhabitz.png', logo_dark = '/sponsor-logos/goodhabitz.png' WHERE slug = 'goodhabitz';
UPDATE brands SET logo_light = '/sponsor-logos/joe.svg', logo_dark = '/sponsor-logos/joe.svg' WHERE slug = 'joe';
UPDATE brands SET logo_light = '/sponsor-logos/50plus-mobiel.svg', logo_dark = '/sponsor-logos/50plus-mobiel.svg' WHERE slug IN ('50plus-mobiel', 'fiftyplus');
