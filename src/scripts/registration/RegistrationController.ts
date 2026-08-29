import { registrationStore } from "./RegistrationStore";
import type { RegistrationStep } from "./RegistrationStore";
import { RegistrationRenderer, type InstructorRecord } from "./RegistrationRenderer";
import { registrationValidation } from "./RegistrationValidation";
import { registrationApi } from "./RegistrationApi";
import { courses } from "../../data/courses";
import { instructors } from "../../data/instructors";
import { schedules } from "../../data/schedule";
import { normalizeMobile, normalizeNationalCode, isValidMobile, resolveSingleOption } from "./RegistrationUtils";
import { getCurrentJalaliYear } from "../../utils/format-date";

type CourseRecord = (typeof courses)[number];

class RegistrationController {
  private renderer: RegistrationRenderer;
  private lockedInstructorId: number | null = null;

  constructor() { this.renderer = new RegistrationRenderer(); this.initialize(); }
  private initialize() { this.bindEvents(); const handled = this.applyDeepLink(); if (!handled) this.showStep("welcome"); }

  private bindEvents() {
    document.addEventListener("click", (event) => {
      const element = (event.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
      if (!element) return;
      switch (element.dataset.action) {
        case "start-registration": this.goToStep("instrument"); break;
        case "select-instrument": this.selectInstrument(element); break;
        case "back-to-instrument": this.goToStep("instrument"); break;
        case "select-instructor": this.selectInstructor(element); break;
        case "back-to-instructor": this.goToStep("instructor"); break;
        case "select-schedule": this.selectSchedule(element); break;
        case "back-to-schedule": this.goToStep("schedule"); break;
        case "continue-student": this.continueFromStudent(); break;
        case "back-to-student": case "edit-student": this.goToStep("student"); break;
        case "edit-instrument": this.goToStep("instrument"); break;
        case "edit-instructor": this.goToStep("instructor"); break;
        case "edit-schedule": this.goToStep("schedule"); break;
        case "submit-registration": this.submitRegistration(); break;
        case "print-receipt": window.print(); break;
        case "print-contract": this.printContract(); break;
        case "back-home": window.location.href = "/"; break;
      }
    });
    document.addEventListener("input", (event) => { const input = event.target as HTMLInputElement; if (input?.dataset?.field === "mobile") this.reflectMobileValidity(input); });
  }

  private applyDeepLink(): boolean {
    const params = new URLSearchParams(window.location.search), courseSlug = params.get("course"), instructorSlug = params.get("instructor");
    if (!courseSlug && !instructorSlug) return false;
    const course = courseSlug ? courses.find((item) => item.active && item.slug === courseSlug) : null;
    const instructor = instructorSlug ? instructors.find((item) => item.active && item.slug === instructorSlug) : null;
    if (instructor) this.lockedInstructorId = instructor.id;
    if (course) { this.applyInstrument(course); return true; }
    if (!instructor) return false;
    const teachableCourses = courses.filter((item) => item.active && (item.instructors ?? []).includes(instructor.id));
    const onlyCourse = resolveSingleOption(teachableCourses);
    if (onlyCourse) { this.applyInstrument(onlyCourse); return true; }
    if (teachableCourses.length > 1) { this.renderer.renderInstrumentIntro(`دوره‌هایی که ${instructor.name} در آموزشگاه موسیقی فاتح تدریس می‌کند را انتخاب کنید.`); this.renderer.filterInstrumentsByInstructor(instructor.id); this.goToStep("instrument"); return true; }
    this.lockedInstructorId = null; return false;
  }

  private selectInstrument(element: HTMLElement) { const id = Number(element.dataset.instrumentId); const course = courses.find((item) => item.id === id); if (course) this.applyInstrument(course); }
  private applyInstrument(course: CourseRecord) {
    registrationStore.selectInstrument({ id: course.id, slug: course.slug, title: course.title, type: course.instrument }); this.updateSelectionSummary();
    if (this.lockedInstructorId !== null) {
      const locked = instructors.find((item) => item.id === this.lockedInstructorId && item.active && (course.instructors ?? []).includes(item.id));
      if (locked) { this.renderer.renderInstructors([locked]); registrationStore.selectInstructor({ id: locked.id, name: locked.name, auto: true }); this.updateSelectionSummary(); this.resolveScheduleForInstructor(locked); return; }
      this.lockedInstructorId = null;
    }
    this.resolveInstructorForCourse(course);
  }
  private resolveInstructorForCourse(course: CourseRecord) {
    const available = instructors.filter((instructor) => instructor.active && (course.instructors ?? []).includes(instructor.id)); this.renderer.renderInstructors(available);
    const only = resolveSingleOption(available);
    if (only) { registrationStore.selectInstructor({ id: only.id, name: only.name, auto: true }); this.updateSelectionSummary(); this.resolveScheduleForInstructor(only); return; }
    this.goToStep("instructor");
  }
  private selectInstructor(element: HTMLElement) { const instructor = instructors.find((item) => item.id === Number(element.dataset.instructorId)); if (!instructor) return; registrationStore.selectInstructor({ id: instructor.id, name: instructor.name, auto: false }); this.updateSelectionSummary(); this.resolveScheduleForInstructor(instructor); }
  private resolveScheduleForInstructor(instructor: InstructorRecord) {
    const available = schedules.filter((schedule) => schedule.active && schedule.instructorId === instructor.id); this.renderer.renderSchedules(available);
    const only = resolveSingleOption(available);
    if (only) { registrationStore.selectSchedule({ id: only.id, weekday: only.weekday, sessionDuration: only.sessionDuration ?? null, classroom: only.classroom ?? null, classMode: only.classMode ?? null, auto: true }); this.updateSelectionSummary(); this.goToStep("student"); return; }
    this.goToStep("schedule");
  }
  private selectSchedule(element: HTMLElement) { const schedule = schedules.find((item) => item.id === Number(element.dataset.scheduleId)); if (!schedule) return; registrationStore.selectSchedule({ id: schedule.id, weekday: schedule.weekday, sessionDuration: schedule.sessionDuration ?? null, classroom: schedule.classroom ?? null, classMode: schedule.classMode ?? null, auto: false }); this.updateSelectionSummary(); this.goToStep("student"); }
  private updateSelectionSummary() { this.renderer.renderSelectionSummary(registrationStore.getState()); }
  private continueFromStudent() { const student = this.collectStudent(); registrationStore.updateStudent(student); const { valid, errors } = registrationValidation.validateStudent(registrationStore.getState().student); this.showStudentErrors(errors); if (!valid) return; this.renderer.updateReview(registrationStore.getState()); this.goToStep("review"); }
  private collectStudent() {
    const scope = document.querySelector('[data-step="student"]'); const student: Record<string, string | number | null> = {};
    scope?.querySelectorAll<HTMLInputElement>("[data-field]").forEach((input) => { const key = input.dataset.field; if (!key) return; if (input.type === "radio") { if (input.checked) student[key] = input.value; return; } if (key === "mobile") { student[key] = normalizeMobile(input.value); return; } if (key === "nationalCode") { student[key] = normalizeNationalCode(input.value); return; } student[key] = input.value; });
    if (student.birthYear) student.birthYear = Number(student.birthYear); student.age = student.birthYear ? getCurrentJalaliYear() - Number(student.birthYear) : null; return student;
  }
  private showStudentErrors(errors: string[]) { const box = document.querySelector<HTMLElement>('[data-step="student"] [data-form-errors]'); if (!box) return; box.hidden = !errors.length; box.innerHTML = errors.map((message) => `<li>${message}</li>`).join(""); }
  private reflectMobileValidity(input: HTMLInputElement) { const group = input.closest(".form-group"); if (!group) return; if (!input.value.trim()) { group.classList.remove("is-valid", "is-invalid"); return; } const valid = isValidMobile(input.value); group.classList.toggle("is-valid", valid); group.classList.toggle("is-invalid", !valid); }
  private async submitRegistration() {
    const state = registrationStore.getState(), validation = registrationValidation.validate(state); if (!validation.valid) { const box = document.querySelector<HTMLElement>('[data-step="review"] [data-form-errors]'); if (box) { box.hidden = false; box.innerHTML = validation.errors.map((message) => `<li>${message}</li>`).join(""); } return; }
    const submitButton = document.querySelector<HTMLButtonElement>('[data-action="submit-registration"]'); submitButton?.setAttribute("disabled", "true");
    try { const response = await registrationApi.submit(state); if (response.success) { registrationStore.setTrackingCode(response.trackingCode || ""); if (response.term) registrationStore.setTerm(response.term); registrationStore.complete(); const completedState = registrationStore.getState(); this.renderer.updateSuccess(completedState); if (typeof window.fbq === "function") window.fbq("track", "Lead", { content_name: "Online Registration", content_category: completedState.selection.instrument.title }); this.goToStep("success"); } else { const box = document.querySelector<HTMLElement>('[data-step="review"] [data-form-errors]'); if (box) { box.hidden = false; box.innerHTML = `<li>${response.message}</li>`; } } } finally { submitButton?.removeAttribute("disabled"); }
  }
  private goToStep(step: RegistrationStep) { registrationStore.setStep(step); this.showStep(step); this.renderer.updateProgress(step); document.querySelector(".registration-container")?.scrollIntoView({ block: "start", behavior: "smooth" }); }
  private showStep(step: string) { document.querySelectorAll<HTMLElement>("[data-step]").forEach((section) => { section.hidden = section.dataset.step !== step; }); }

  /**
   * Fetches the real, server-rendered contract PDF (env.BROWSER via
   * api/contract-pdf.ts -- see that file for why a tracking code alone is
   * enough, this early in the flow) and opens it in a new tab. Opens the
   * blank tab synchronously, on the click itself, so popup blockers can't
   * interfere; swaps in the PDF once it's ready. Same pattern the admin
   * panel's own "چاپ قرارداد" button already uses.
   */
  private async printContract() {
    const state = registrationStore.getState();
    if (!state.trackingCode) return;

    const button = document.querySelector<HTMLButtonElement>('[data-action="print-contract"]');
    const tab = window.open("about:blank", "_blank");
    if (tab) {
      tab.document.title = "در حال آماده‌سازی قرارداد...";
      tab.document.body.innerHTML = '<div style="font-family:Tahoma,sans-serif;direction:rtl;text-align:center;padding:48px">در حال تولید PDF قرارداد...</div>';
    }
    button?.setAttribute("disabled", "true");

    try {
      const response = await fetch("/api/contract-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracking_code: state.trackingCode })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({ message: "تولید قرارداد شکست خورد." }))) as { message?: string };
        tab?.close();
        window.alert(data.message ?? "تولید قرارداد شکست خورد.");
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      if (tab) { tab.location.replace(url); tab.focus(); } else { window.open(url, "_blank"); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      tab?.close();
      window.alert("خطای شبکه هنگام تولید قرارداد.");
    } finally {
      button?.removeAttribute("disabled");
    }
  }
}
export { RegistrationController };
