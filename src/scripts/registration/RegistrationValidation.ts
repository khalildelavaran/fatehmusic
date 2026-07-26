/*
====================================================
File: src/scripts/registration/RegistrationValidation.ts

Purpose:
Registration data validation layer. This is the single source
of truth for validation rules and their Persian error messages -
both the per-step check (student form) and the final pre-submit
check in RegistrationController call into this file, so the two
can never drift out of sync with each other.

Architecture:
- No UI logic, no DOM manipulation
====================================================
*/

import type { RegistrationState, RegistrationStudent } from "./RegistrationStore";
import { isValidMobile } from "./RegistrationUtils";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

class RegistrationValidation {
  /** Validates just the student form fields (used by the "continue" step). */
  validateStudent(student: Partial<RegistrationStudent>): ValidationResult {
    const errors: string[] = [];

    if (!student.firstName?.trim()) {
      errors.push("نام هنرجو وارد نشده است.");
    }

    if (!student.lastName?.trim()) {
      errors.push("نام خانوادگی هنرجو وارد نشده است.");
    }

    if (!isValidMobile(student.mobile || "")) {
      errors.push("شماره موبایل صحیح نیست.");
    }

    if (!student.age) {
      errors.push("سن هنرجو وارد نشده است.");
    } else if (student.age < 3 || student.age > 100) {
      errors.push("سن وارد شده معتبر نیست.");
    }

    if (!student.gender) {
      errors.push("لطفاً جنسیت هنرجو را انتخاب کنید.");
    }

    if (!student.hasInstrument) {
      errors.push("لطفاً وضعیت داشتن ساز را مشخص کنید.");
    }

    return { valid: errors.length === 0, errors };
  }

  /** Validates the entire wizard state, used as the final gate before submission. */
  validate(state: RegistrationState): ValidationResult {
    const errors: string[] = [];

    if (!state.selection.instrument?.id) {
      errors.push("لطفاً ساز مورد نظر را انتخاب کنید.");
    }

    if (!state.selection.instructor?.id) {
      errors.push("لطفاً استاد مورد نظر را انتخاب کنید.");
    }

    if (!state.selection.schedule?.id) {
      errors.push("لطفاً زمان کلاس را انتخاب کنید.");
    }

    errors.push(...this.validateStudent(state.student).errors);

    return { valid: errors.length === 0, errors };
  }
}

export const registrationValidation = new RegistrationValidation();
