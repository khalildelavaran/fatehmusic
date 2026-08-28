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

  /** Uses a hidden iframe instead of window.open, so popup blockers cannot interfere with printing. */
  private printContract() {
    const source = document.querySelector<HTMLElement>("[data-contract-container]"); if (!source || !source.innerHTML.trim()) return;
    const state = registrationStore.getState();
    const date = this.toPersianDigits(String(state.term?.completionDate ?? state.term?.date ?? new Date().toLocaleDateString("fa-IR")));
    const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
    const frame = document.createElement("iframe"); frame.setAttribute("aria-hidden", "true"); frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(frame);
    const doc = frame.contentDocument; if (!doc) { frame.remove(); return; }
    doc.open();
    doc.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>قرارداد هنرجویی</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><style>
      @page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0!important;padding:0!important;width:210mm!important;height:297mm!important;background:#fff!important;color:#000!important;font-family:Vazirmatn,Tahoma,sans-serif!important}body{overflow:hidden!important}.sheet{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;padding:32mm 15mm 25mm;border:.35mm solid #c8a94e}.sheet:before{content:"";position:absolute;inset:4.5mm;border:.18mm solid #dfcf9b;pointer-events:none}.print-header{position:absolute;top:7mm;right:12mm;left:12mm;height:22mm;display:grid;grid-template-columns:42mm 1fr 42mm;direction:rtl;align-items:center;border-bottom:.45mm solid #b9973e}.header-logo-wrap{display:flex;align-items:center;justify-content:flex-start;height:19mm}.header-logo{display:block!important;width:18mm!important;height:18mm!important;max-width:18mm!important;max-height:18mm!important;min-width:0!important;min-height:0!important;object-fit:contain!important}.header-title{text-align:center;font-size:18pt;font-weight:900;color:#000}.header-date{text-align:left;font-size:9pt;font-weight:700;color:#000;direction:rtl}.contract-content{width:100%;height:100%;overflow:hidden;color:#000!important}.contract-content,.contract-content *{color:#000!important;-webkit-text-fill-color:#000!important;text-shadow:none!important}.contract-content p,.contract-content span,.contract-content strong,.contract-content h1,.contract-content h2,.contract-content h3,.contract-content h4,.contract-content div{color:#000!important}.contract-article,.contract-signature{break-inside:avoid;page-break-inside:avoid}.contract-article{margin-bottom:5px!important}.contract-article h4{color:#000!important}.contract-article p{color:#000!important}.print-footer{position:absolute;right:12mm;left:12mm;bottom:6mm;height:15mm;border-top:.4mm solid #b9973e;display:grid;grid-template-columns:1.85fr 1fr 1.2fr 1.15fr;direction:rtl;gap:2mm;align-items:center;color:#000}.footer-item{min-width:0;padding:0 2mm;text-align:center;border-left:.2mm solid #d7c78f;color:#000;font-size:6.4pt;line-height:1.55;white-space:nowrap}.footer-item:last-child{border-left:0}.footer-label{font-weight:800;color:#000}.footer-value{font-weight:500;color:#000}
    </style></head><body><main class="sheet"><header class="print-header"><div class="header-logo-wrap"><img class="header-logo" src="/logo.png" alt="آموزشگاه موسیقی فاتح"></div><div class="header-title">قرارداد هنرجویی</div><div class="header-date">تاریخ: ${esc(date)}</div></header><section class="contract-content">${source.innerHTML}</section><footer class="print-footer"><div class="footer-item"><span class="footer-label">آدرس:</span> <span class="footer-value">خیابان امام شرقی، پس از پاساژ مهستان، محوطه دوم پارکینگ حاج سلیمان</span></div><div class="footer-item"><span class="footer-label">تلفن:</span> <span class="footer-value">۰۶۱-۳۶۲۲۱۱۷۴</span></div><div class="footer-item"><span class="footer-label">موبایل / WhatsApp:</span> <span class="footer-value">۰۹۳۳-۳۱۳-۹۳۱۹</span></div><div class="footer-item"><span class="footer-label">Instagram:</span> <span class="footer-value">fateh.music.academy</span></div></footer></main></body></html>`);
    doc.close();
    const cleanup = () => { frame.remove(); };
    const print = () => { try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } finally { setTimeout(cleanup, 1500); } };
    if (doc.fonts?.ready) doc.fonts.ready.then(() => setTimeout(print, 100)); else setTimeout(print, 300);
  }
  private toPersianDigits(value: string) { return value.replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]); }
}
export { RegistrationController };
