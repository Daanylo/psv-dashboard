-- Brands Table
-- Stores brand configuration including colors

CREATE TABLE IF NOT EXISTS brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Core Identification
  name VARCHAR(100) NOT NULL UNIQUE,       -- Display Name (e.g. "PUMA")
  slug VARCHAR(100) NOT NULL UNIQUE,       -- URL/API friendly key (e.g. "puma")
  
  -- Visuals
  color VARCHAR(7) DEFAULT '#000000',      -- Hex Color
  logo_dark_url VARCHAR(255),              -- URL for logo on dark background
  logo_light_url VARCHAR(255),             -- URL for logo on light background
  
  -- Matching Configuration
  match_keywords TEXT,                     -- Comma separated keywords for SQL LIKE matching (e.g. "puma, puma.com")
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: Link table if we want dynamic strict linking later
ALTER TABLE logo_detections ADD COLUMN brand_id INT NULL;
-- ALTER TABLE logo_detections ADD CONSTRAINT fk_logo_detections_brand_id FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL;

-- Initial Seed Data (based on current hardcoded values)
INSERT INTO brands (name, slug, color, match_keywords) VALUES
('PUMA', 'puma', '#FF0000', 'puma'),
('Brainport', 'brainport', '#6e0078', 'brainport'),
('EnergieDirect', 'energiedirect', '#1fa12d', 'energiedirect, energie direct'),
('Simac', 'simac', '#005baa', 'simac'),
('GoodHabitz', 'goodhabitz', '#ffc107', 'goodhabitz'),
('JOE', 'joe', '#ec008c', 'joe'),
('50+ Mobiel', 'fiftyplus', '#f39200', '50+, fiftyplus, 50plus');
