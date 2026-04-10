-- Migration: Remove Level 3, rename Level 4 → Level 3
-- Old Level 3 (unlabeled/default content) is removed from the system.
-- Old Level 4 (advanced content) becomes the new Level 3.
-- Order matters: migrate 3→2 first, then 4→3 to avoid collision.
UPDATE students SET reading_level = 2 WHERE reading_level = 3;
UPDATE students SET reading_level = 3 WHERE reading_level = 4;
