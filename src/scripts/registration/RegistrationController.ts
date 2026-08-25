/*
====================================================
File: src/scripts/registration/RegistrationController.ts

Purpose:
Main controller for the Registration Wizard.

Architecture:
- Binds user actions (clicks, form input)
- Reads the real data files (courses / instructors / schedule)
  and filters them for the current selection
- Updates RegistrationStore, then asks RegistrationRenderer to
  reflect the new state in the DOM
- Runs validation and talks to RegistrationApi at submit time

Auto-resolution:
Whenever a step's choice is a foregone conclusion (a course with
only one active instructor, an instructor with only one open
time slot), that step is resolved for the student instead of
making them click a single card. The resolved value is still
rendered into the step's container (so "back" always shows real,
correct content) and is reflected in the persistent selection
summary bar, so the student always knows their instructor/time
even though they never had to choose it.

Deep links:
/register?course=<slug> and /register?instructor=<slug> (and the
two combined) pre-fill the wizard when a student arrives from a
specific course or instructor page, skipping the welcome screen
and any steps that are now already answered.
====================================================
*/

import { registrationStore } from "./RegistrationStore";
import type { RegistrationStep } from "./RegistrationStore";
import { RegistrationRenderer, type InstructorRecord } from "./RegistrationRenderer";
import { registrationValidation } from "./RegistrationValidation";
import { registrationApi } from "./RegistrationApi";
import { courses } from "../../data/courses";
import { instructors } from "../../data/instructors";
import { schedules } from "../../data/schedule";
import { normalizeMobile, normalizeNationalCode, isValidMobile, resolveSingleOption } from "./RegistrationUtils";

type CourseRecord = (typeof courses)[number];

class RegistrationController {
  private renderer: RegistrationRenderer;
  /**
   * Set only while walking through a deep link that named a specific
   * instructor. Consumed the moment an instrument/course is settled, so
   * that course's instructor step can be skipped in favour of this one.
   */
  private lockedInstructorId: number | null = null;

  constructor() {
    this.renderer = new RegistrationRenderer();
    this.initialize();
  }

  private initialize() {
    this.bindEvents();
    const handled = this.applyDeepLink();
    if (!handled) this.showStep("welcome");
  }

  private bindEvents() {
    document.addEventListener("click", (event) => {
      const element = (event.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
      if (!element) return;

      const action = element.dataset.action;
      switch (action) {
        case "start-registration": this.goToStep("instrument"); break;
        case "select-instrument": this.selectInstrument(element); break;
        case "back-to-instrument": this.goToStep("instrument"); break;
        case "select-instructor": this.selectInstructor(element); break;
        case "back-to-instructor": this.goToStep("instructor"); break;
        case "select-schedule": this.selectSchedule(element); break;
        case "back-to-schedule": this.goToStep("schedule"); break;
        case "continue-student": this.continueFromStudent(); break;
        case "back-to-student":
        case "edit-student": this.goToStep("student"); break;
        case "edit-instrument": this.goToStep("instrument"); break;
        case "edit-instructor": this.goToStep("instructor"); break;
        case "edit-schedule": this.goToStep("schedule"); break;
        case "submit-registration": this.submitRegistration(); break;
        case "print-receipt": window.print(); break;
        case "print-contract": this.printContract(); break;
        case "back-home": window.location.href = "/"; break;
      }
    });

    document.addEventListener("input", (event) => {
      const input = event.target as HTMLInputElement;
      if (input?.dataset?.field === "mobile") this.reflectMobileValidity(input);
    });
  }

  // --------------------------------------------------------------
  // Deep links: /register?course=slug, /register?instructor=slug
  // --------------------------------------------------------------

  /** Returns true if a query-param course/instructor was recognized and the wizard was advanced past "welcome". */
  private applyDeepLink(): boolean {
    const params = new URLSearchParams(window.location.search);
    const courseSlug = params.get("course");
    const instructorSlug = params.get("instructor");
    if (!courseSlug && !instructorSlug) return false;

    const course = courseSlug ? courses.find((item) => item.active && item.slug === courseSlug) : null;
    const instructor = instructorSlug ? instructors.find((item) => item.active && item.slug === instructorSlug) : null;

    if (instructor) {
      this.lockedInstructorId = instructor.id;
    }

    if (course) {
      this.applyInstrument(course);
      return true;
    }

    if (!instructor) return false;

    const teachableCourses = courses.filter((item) => item.active && (item.instructors ?? []).includes(instructor.id));
    const onlyCourse = resolveSingleOption(teachableCourses);

    if (onlyCourse) {
      this.applyInstrument(onlyCourse);
      return true;
    }

    if (teachableCourses.length > 1) {
      this.renderer.renderInstrumentIntro(`دوره‌هایی که ${instructor.name} در آموزشگاه موسیقی فاتح تدریس می‌کند را انتخاب کنید.`);
      this.renderer.filterInstrumentsByInstructor(instructor.id);
      this.goToStep("instrument");
      return true;
    }

    // Instructor slug matched no active course; fall back to the normal welcome screen.
    this.lockedInstructorId = null;
    return false;
  }

  // --------------------------------------------------------------
  // Selection + auto-resolution chain
  // --------------------------------------------------------------

  private selectInstrument(element: HTMLElement) {
    const id = Number(element.dataset.instrumentId);
    const course = courses.find((item) => item.id === id);
    if (!course) return;
    this.applyInstrument(course);
  }

  /** Shared by manual clicks on Step 1 and by the course/instructor deep links. */
  private applyInstrument(course: CourseRecord) {
    registrationStore.selectInstrument({
      id: course.id,
      slug: course.slug,
      title: course.title,
      type: course.instrument
    });
    this.updateSelectionSummary();

    if (this.lockedInstructorId !== null) {
      const locked = instructors.find(
        (item) => item.id === this.lockedInstructorId && item.active && (course.instructors ?? []).includes(item.id)
      );
      if (locked) {
        this.renderer.renderInstructors([locked]);
        registrationStore.selectInstructor({ id: locked.id, name: locked.name, auto: true });
        this.updateSelectionSummary();
        this.resolveScheduleForInstructor(locked);
        return;
      }
      // The locked instructor doesn't actually teach this course (shouldn't
      // happen given the filtering above, but don't trust a stale link).
      this.lockedInstructorId = null;
    }

    this.resolveInstructorForCourse(course);
  }

  /** Renders the instructor step's real content either way, then skips it automatically when there is only one option. */
  private resolveInstructorForCourse(course: CourseRecord) {
    const available = instructors.filter(
      (instructor) => instructor.active && (course.instructors ?? []).includes(instructor.id)
    );
    this.renderer.renderInstructors(available);

    const only = resolveSingleOption(available);
    if (only) {
      registrationStore.selectInstructor({ id: only.id, name: only.name, auto: true });
      this.updateSelectionSummary();
      this.resolveScheduleForInstructor(only);
      return;
    }

    this.goToStep("instructor");
  }

  private selectInstructor(element: HTMLElement) {
    const id = Number(element.dataset.instructorId);
    const instructor = instructors.find((item) => item.id === id);
    if (!instructor) return;

    registrationStore.selectInstructor({ id: instructor.id, name: instructor.name, auto: false });
    this.updateSelectionSummary();
    this.resolveScheduleForInstructor(instructor);
  }

  /** Renders the schedule step's real content either way, then skips it automatically when there is only one open time. */
  private resolveScheduleForInstructor(instructor: InstructorRecord) {
    const available = schedules.filter((schedule) => schedule.active && schedule.instructorId === instructor.id);
    this.renderer.renderSchedules(available);

    const only = resolveSingleOption(available);
    if (only) {
      registrationStore.selectSchedule({
        id: only.id,
        weekday: only.weekday,
        sessionDuration: only.sessionDuration ?? null,
        classroom: only.classroom ?? null,
        classMode: only.classMode ?? null,
        auto: true
      });
      this.updateSelectionSummary();
      this.goToStep("student");
      return;
    }

    this.goToStep("schedule");
  }

  private selectSchedule(element: HTMLElement) {
    const id = Number(element.dataset.scheduleId);
    const schedule = schedules.find((item) => item.id === id);
    if (!schedule) return;

    registrationStore.selectSchedule({
      id: schedule.id,
      weekday: schedule.weekday,
      sessionDuration: schedule.sessionDuration ?? null,
      classroom: schedule.classroom ?? null,
      classMode: schedule.classMode ?? null,
      auto: false
    });
    this.updateSelectionSummary();
    this.goToStep("student");
  }

  private updateSelectionSummary() {
    this.renderer.renderSelectionSummary(registrationStore.getState());
  }

  // --------------------------------------------------------------
  // Student form + submission (unchanged)
  // --------------------------------------------------------------

  private continueFromStudent() {
    const student = this.collectStudent();
    registrationStore.updateStudent(student);

    const { valid, errors } = registrationValidation.validateStudent(registrationStore.getState().student);
    this.showStudentErrors(errors);
    if (!valid) return;

    this.renderer.updateReview(registrationStore.getState());
    this.goToStep("review");
  }

  private collectStudent() {
    const scope = document.querySelector('[data-step="student"]');
    const student: Record<string, string | number> = {};

    scope?.querySelectorAll<HTMLInputElement>("[data-field]").forEach((input) => {
      const key = input.dataset.field;
      if (!key) return;

      if (input.type === "radio") {
        if (input.checked) student[key] = input.value;
        return;
      }

      if (key === "mobile") {
        student[key] = normalizeMobile(input.value);
        return;
      }

      if (key === "nationalCode") {
        student[key] = normalizeNationalCode(input.value);
        return;
      }

      student[key] = input.value;
    });

    if (student.age) student.age = Number(student.age);
    if (student.birthYear) student.birthYear = Number(student.birthYear);
    return student;
  }

  private showStudentErrors(errors: string[]) {
    const box = document.querySelector<HTMLElement>('[data-step="student"] [data-form-errors]');
    if (!box) return;

    if (!errors.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }

    box.hidden = false;
    box.innerHTML = errors.map((message) => `<li>${message}</li>`).join("");
  }

  private reflectMobileValidity(input: HTMLInputElement) {
    const group = input.closest(".form-group");
    if (!group) return;

    if (!input.value.trim()) {
      group.classList.remove("is-valid", "is-invalid");
      return;
    }

    const valid = isValidMobile(input.value);
    group.classList.toggle("is-valid", valid);
    group.classList.toggle("is-invalid", !valid);
  }

  private async submitRegistration() {
    const state = registrationStore.getState();
    const validation = registrationValidation.validate(state);

    if (!validation.valid) {
      const box = document.querySelector<HTMLElement>('[data-step="review"] [data-form-errors]');
      if (box) {
        box.hidden = false;
        box.innerHTML = validation.errors.map((message) => `<li>${message}</li>`).join("");
      }
      return;
    }

    const submitButton = document.querySelector<HTMLButtonElement>('[data-action="submit-registration"]');
    submitButton?.setAttribute("disabled", "true");

    try {
      const response = await registrationApi.submit(state);

      if (response.success) {
        registrationStore.setTrackingCode(response.trackingCode || "");
        registrationStore.complete();

        const completedState = registrationStore.getState();
        this.renderer.updateSuccess(completedState);

        if (typeof window.fbq === "function") {
          window.fbq("track", "Lead", {
            content_name: "Online Registration",
            content_category: completedState.selection.instrument.title
          });
        }

        this.goToStep("success");
      } else {
        const box = document.querySelector<HTMLElement>('[data-step="review"] [data-form-errors]');
        if (box) {
          box.hidden = false;
          box.innerHTML = `<li>${response.message}</li>`;
        }
      }
    } finally {
      submitButton?.removeAttribute("disabled");
    }
  }

  private goToStep(step: RegistrationStep) {
    registrationStore.setStep(step);
    this.showStep(step);
    this.renderer.updateProgress(step);
    document.querySelector(".registration-container")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  private showStep(step: string) {
    document.querySelectorAll<HTMLElement>("[data-step]").forEach((section) => {
      section.hidden = section.dataset.step !== step;
    });
  }

  /**
   * Prints only the contract card, not the rest of the success page.
   * The "printing-contract" class is matched by @media print rules in
   * registration.css that hide everything else and show the contract
   * in full (no scroll clipping) while it's present.
   */
  private printContract() {
    document.body.classList.add("printing-contract");
    const cleanup = () => document.body.classList.remove("printing-contract");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    // Safety net for browsers that don't fire afterprint reliably.
    setTimeout(cleanup, 2000);
  }
}

export { RegistrationController };
