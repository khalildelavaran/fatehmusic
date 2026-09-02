-- Calendar exceptions are advisory; they never automatically cancel sessions.
-- A holiday can coexist with a scheduled or completed class.
ALTER TABLE calendar_exceptions ADD COLUMN applies_to_all_classes INTEGER NOT NULL DEFAULT 1;
ALTER TABLE calendar_exceptions ADD COLUMN notes TEXT;
