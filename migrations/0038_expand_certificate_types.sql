-- Expand the certificate system beyond course-completion certificates.
-- Existing certificates remain course_completion by default.

ALTER TABLE issued_certificates ADD COLUMN certificate_type TEXT NOT NULL DEFAULT 'course_completion';
ALTER TABLE issued_certificates ADD COLUMN event_title TEXT;
ALTER TABLE issued_certificates ADD COLUMN event_date_jalali TEXT;
ALTER TABLE issued_certificates ADD COLUMN event_role TEXT;
ALTER TABLE issued_certificates ADD COLUMN event_details TEXT;
ALTER TABLE issued_certificates ADD COLUMN event_instructor TEXT;
ALTER TABLE issued_certificates ADD COLUMN workshop_hours TEXT;

CREATE INDEX IF NOT EXISTS idx_issued_certificates_type ON issued_certificates(certificate_type);
