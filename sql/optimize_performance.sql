-- Optimize instagram_comments table for faster date range queries
-- This adds a generated column that normalizes the created_at timestamp to seconds
-- and adds an index on it.

-- 1. Add generated column (STORED means it's computed on write and stored on disk)
ALTER TABLE instagram_comments
ADD COLUMN created_at_ts BIGINT GENERATED ALWAYS AS (
  CASE 
    WHEN created_at > 100000000000000 THEN FLOOR(created_at / 1000000) 
    WHEN created_at > 1000000000000 THEN FLOOR(created_at / 1000) 
    ELSE FLOOR(created_at) 
  END
) STORED;

-- 2. Create an index on the new timestamp column
CREATE INDEX idx_ic_created_at_ts ON instagram_comments(created_at_ts);

-- 3. (Optional) text index for player_mentioned to help with filtering (though regex/like is still needed)
-- CREATE INDEX idx_ic_player_mentioned ON instagram_comments(player_mentioned(50));
