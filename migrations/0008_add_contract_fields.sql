-- ====================================================================
-- Migration 0008: add fields required to fill the student contract
-- (قرارداد هنرجویی) that is generated at the end of registration.
--
-- Diffed against the two uploaded contract templates: everything else
-- the contract needs (name, national code, mobile, instrument,
-- instructor, schedule) is already collected. These five are not.
-- ====================================================================

ALTER TABLE registrations ADD COLUMN student_father_name TEXT NOT NULL DEFAULT '';
ALTER TABLE registrations ADD COLUMN student_id_issue_place TEXT NOT NULL DEFAULT '';
ALTER TABLE registrations ADD COLUMN student_birth_year INTEGER NOT NULL DEFAULT 0;
ALTER TABLE registrations ADD COLUMN student_occupation TEXT NOT NULL DEFAULT '';
ALTER TABLE registrations ADD COLUMN student_address TEXT NOT NULL DEFAULT '';
