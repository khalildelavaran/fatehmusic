-- Instructor compensation percentage used by the monthly workload dashboard.
-- 50% is the business default and can be changed per instructor in the admin panel.
ALTER TABLE instructors ADD COLUMN pay_percentage INTEGER NOT NULL DEFAULT 50;

UPDATE instructors
SET pay_percentage = 50
WHERE pay_percentage IS NULL OR pay_percentage < 0 OR pay_percentage > 100;

CREATE INDEX IF NOT EXISTS idx_instructors_pay_percentage
  ON instructors(pay_percentage);
