-- ====================================================================
-- Migration 0031: backfill legacy class_students into enrollments.
--
-- class_students remains as a compatibility boundary, but the operational
-- domain must be able to report existing memberships immediately after
-- deployment. Use the legacy row id as the provenance key so the backfill is
-- idempotent and never fabricates a second normalized enrollment for the same
-- legacy membership.
-- ====================================================================

INSERT INTO enrollments
  (class_id, student_id, enrolled_at, status, source_class_student_id)
SELECT
  cs.class_id,
  cs.student_id,
  cs.enrollment_date,
  cs.status,
  cs.id
FROM class_students cs
WHERE NOT EXISTS (
  SELECT 1
  FROM enrollments e
  WHERE e.source_class_student_id = cs.id
)
AND NOT EXISTS (
  SELECT 1
  FROM enrollments e
  WHERE e.class_id = cs.class_id
    AND e.student_id = cs.student_id
    AND e.status = 'active'
    AND cs.status = 'active'
);

CREATE INDEX IF NOT EXISTS idx_enrollments_source_class_student
  ON enrollments(source_class_student_id);
