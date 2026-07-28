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
====================================================
*/

import { registrationStore } from "./RegistrationStore";
import type { RegistrationStep } from "./RegistrationStore";
import { RegistrationRenderer } from "./RegistrationRenderer";
import { registrationValidation } from "./RegistrationValidation";
import { registrationApi } from "./RegistrationApi";
import { courses } from "../../data/courses";
import { instructors } from "../../data/instructors";
import { schedules } from "../../data/schedule";
import { normalizeMobile, isValidMobile } from "./RegistrationUtils";

class RegistrationController {
  private renderer: RegistrationRenderer;

  constructor() {
    this.renderer = new RegistrationRenderer();
    this.initialize();
  }

  private initialize() {
    this.bindEvents();
    this.showStep("welcome");
  }

  /* ==================================================
     Event binding
  ================================================== */

  private bindEvents() {
    document.addEventListener("click", (event) => {
      const element = (event.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
      if (!element) return;

      const action = element.dataset.action;

      switch (action) {
        case "start-registration":
          this.goToStep("instrument");
          break;

        case "select-instrument":
          this.selectInstrument(element);
          break;

        case "back-to-instrument":
          this.goToStep("instrument");
          break;

        case "select-instructor":
          this.selectInstructor(element);
          break;

        case "back-to-instructor":
          this.goToStep("instructor");
          break;

        case "select-schedule":
          this.selectSchedule(element);
          break;

        case "back-to-schedule":
          this.goToStep("schedule");
          break;

        case "continue-student":
          this.continueFromStudent();
          break;

        case "back-to-student":
        case "edit-student":
          this.goToStep("student");
          break;

        case "edit-instrument":
          this.goToStep("instrument");
          break;

        case "edit-instructor":
          this.goToStep("instructor");
          break;

        case "edit-schedule":
          this.goToStep("schedule");
          break;

        case "submit-registration":
          this.submitRegistration();
          break;

        case "print-receipt":
          window.print();
          break;

        case "back-home":
          window.location.href = "/";
          break;
      }
    });

    document.addEventListener("input", (event) => {
      const input = event.target as HTMLInputElement;
      if (input?.dataset?.field === "mobile") {
        this.reflectMobileValidity(input);
      }
    });
  }

  /* ==================================================
     Instrument -> Instructor
  ================================================== */

  private selectInstrument(element: HTMLElement) {
    const id = Number(element.dataset.instrumentId);
    const course = courses.find((item) => item.id === id);
    if (!course) return;

    registrationStore.selectInstrument({
      id: course.id,
      slug: course.slug,
      title: course.title,
      type: course.instrument
    });

    const available = instructors.filter(
      (instructor) => instructor.active && (course.instructors ?? []).includes(instructor.id)
    );

    this.renderer.renderInstructors(available);
    this.goToStep("instructor");
  }

  /* ==================================================
     Instructor -> Schedule
  ================================================== */

  private selectInstructor(element: HTMLElement) {
    const id = Number(element.dataset.instructorId);
    const instructor = instructors.find((item) => item.id === id);
    if (!instructor) return;

    registrationStore.selectInstructor({
      id: instructor.id,
      name: instructor.name
    });

    const available = schedules.filter((schedule) => schedule.active && schedule.instructorId === instructor.id);

    this.renderer.renderSchedules(available);
    this.goToStep("schedule");
  }

  /* ==================================================
     Schedule -> Student
  ================================================== */

  private selectSchedule(element: HTMLElement) {
    const id = Number(element.dataset.scheduleId);
    const schedule = schedules.find((item) => item.id === id);
    if (!schedule) return;

    registrationStore.selectSchedule({
      id: schedule.id,
      weekday: schedule.weekday,
      sessionDuration: schedule.sessionDuration ?? null,
      classroom: schedule.classroom ?? null,
      classMode: schedule.classMode ?? null
    });

    this.goToStep("student");
  }

  /* ==================================================
     Student -> Review
  ================================================== */

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

      student[key] = input.value;
    });

    if (student.age) student.age = Number(student.age);

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

  /* ==================================================
     Submit
  ================================================== */

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
        this.renderer.updateSuccess(registrationStore.getState());
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

  /* ==================================================
     Step navigation
  ================================================== */

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
}

export { RegistrationController };
