/*
====================================================
File: src/scripts/registration/RegistrationRenderer.ts

Purpose:
Everything that writes dynamic data into the DOM for the
Registration Wizard: instructor/schedule lists, the progress
stepper, the review summary, and the success screen.
====================================================
*/

import type { RegistrationState } from "./RegistrationStore";
import { contact } from "../../data/contact";
import { getMaterialsByInstrument } from "../../data/materials";
import {
  classModeLabel,
  escapeHtml,
  formatMobileDisplay,
  formatToman,
  getPricingPlan,
  sortByWeekday,
  toPersianDigits
} from "./RegistrationUtils";

export interface InstructorRecord {
  id: number;
  name: string;
  slug?: string;
  media?: { images?: { profile?: string } };
  professional?: { roles?: string[] };
  content?: { excerpt?: string };
}

export interface ScheduleRecord {
  id: number;
  weekday: string;
  sessionDuration?: number;
  classroom?: string | number;
  classMode?: string;
}

const PROGRESS_STEPS = ["instrument", "instructor", "schedule", "student", "review"] as const;

class RegistrationRenderer {
  updateProgress(step: string) {
    const rail = document.querySelector<HTMLElement>("[data-progress]");
    if (!rail) return;
    const isWizardStep = (PROGRESS_STEPS as readonly string[]).includes(step);
    rail.hidden = !isWizardStep && step !== "success";
    const currentIndex = step === "success" ? PROGRESS_STEPS.length : PROGRESS_STEPS.indexOf(step as (typeof PROGRESS_STEPS)[number]);
    rail.querySelectorAll<HTMLElement>("[data-progress-step]").forEach((node) => {
      const nodeStep = node.dataset.progressStep as (typeof PROGRESS_STEPS)[number];
      const nodeIndex = PROGRESS_STEPS.indexOf(nodeStep);
      node.classList.remove("is-active", "is-complete");
      if (nodeIndex < currentIndex) node.classList.add("is-complete");
      else if (nodeIndex === currentIndex) node.classList.add("is-active");
    });
  }

  renderSelectionSummary(state: RegistrationState) {
    const el = document.querySelector<HTMLElement>("[data-selection-summary]");
    if (!el) return;
    const { instrument, instructor, schedule } = state.selection;
    const chips: string[] = [];
    if (instrument.title) chips.push(this.summaryChip("ساز", instrument.title));
    if (instructor.name) chips.push(this.summaryChip("استاد", instructor.name, instructor.auto));
    if (schedule.weekday) chips.push(this.summaryChip("زمان", this.formatSchedule(schedule) ?? "", schedule.auto));
    if (!chips.length) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    el.innerHTML = chips.join("");
  }

  private summaryChip(label: string, value: string, auto?: boolean): string {
    return `<span class="summary-chip"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span>${auto ? `<em>پیشنهادی</em>` : ""}</span>`;
  }

  renderInstrumentIntro(text: string) {
    const el = document.querySelector<HTMLElement>("[data-step=\"instrument\"] [data-step-subtitle]");
    if (el) el.textContent = text;
  }

  /**
   * When registration starts from an instructor profile, show only the
   * courses actually taught by that instructor and remove now-empty
   * instrument categories. This prevents unrelated instrument groups from
   * remaining visible after their cards have been filtered out.
   */
  filterInstrumentsByInstructor(instructorId: number) {
    document.querySelectorAll<HTMLElement>('[data-step="instrument"] .instrument-category').forEach((category) => {
      const cards = Array.from(category.querySelectorAll<HTMLElement>("[data-instrument-id]"));
      let visibleCount = 0;
      for (const card of cards) {
        const ids = (card.dataset.instructorIds ?? "")
          .split(",")
          .filter(Boolean)
          .map(Number);
        const visible = ids.includes(instructorId);
        card.hidden = !visible;
        if (visible) visibleCount += 1;
      }
      category.dataset.empty = visibleCount === 0 ? "true" : "false";
    });
  }

  renderInstructors(list: InstructorRecord[]) {
    const container = document.querySelector<HTMLElement>("[data-instructors-container]");
    if (!container) return;
    if (!list.length) {
      container.innerHTML = this.emptyState("استادی برای این ساز در حال حاضر موجود نیست.");
      return;
    }
    const isAuto = list.length === 1;
    container.innerHTML = list.map((instructor) => {
      const roles = instructor.professional?.roles ?? [];
      const image = instructor.media?.images?.profile;
      return `<article class="registration-card instructor-card${isAuto ? " is-auto-selected" : ""}" data-action="select-instructor" data-instructor-id="${instructor.id}" tabindex="0" role="button">
        ${isAuto ? `<div class="auto-badge">استاد این دوره</div>` : ""}
        <div class="instructor-portrait">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(instructor.name)}" loading="lazy" />` : `<span class="portrait-fallback">${escapeHtml(instructor.name.charAt(0))}</span>`}</div>
        <div class="instructor-content">
          <h3>${escapeHtml(instructor.name)}</h3>
          ${roles.length ? `<div class="tag-row">${roles.map((role) => `<span class="mini-tag">${escapeHtml(role)}</span>`).join("")}</div>` : ""}
          ${instructor.content?.excerpt ? `<p class="instructor-excerpt">${escapeHtml(instructor.content.excerpt)}</p>` : ""}
        </div>
        <div class="select-indicator">${isAuto ? "تأیید و ادامه" : "انتخاب استاد"}</div>
      </article>`;
    }).join("");
  }

  renderSchedules(list: ScheduleRecord[]) {
    const container = document.querySelector<HTMLElement>("[data-schedules-container]");
    if (!container) return;
    if (!list.length) {
      container.innerHTML = this.emptyState("در حال حاضر زمان آزادی برای این استاد ثبت نشده است.");
      return;
    }
    const sorted = sortByWeekday(list);
    const isAuto = sorted.length === 1;
    container.innerHTML = sorted.map((schedule) => `<article class="registration-card schedule-card${isAuto ? " is-auto-selected" : ""}" data-action="select-schedule" data-schedule-id="${schedule.id}" tabindex="0" role="button">
      ${isAuto ? `<div class="auto-badge">تنها زمان موجود</div>` : ""}
      <div class="schedule-day">${escapeHtml(schedule.weekday)}</div>
      <ul class="schedule-meta">
        ${schedule.sessionDuration ? `<li>${toPersianDigits(schedule.sessionDuration)} دقیقه</li>` : ""}
        ${schedule.classroom ? `<li>کلاس ${toPersianDigits(schedule.classroom)}</li>` : ""}
        <li>${classModeLabel(schedule.classMode)}</li>
      </ul>
      <div class="select-indicator">${isAuto ? "تأیید و ادامه" : "انتخاب این زمان"}</div>
    </article>`).join("");
  }

  private emptyState(message: string): string {
    return `<div class="registration-card empty-state"><p>${escapeHtml(message)}</p></div>`;
  }

  updateReview(state: RegistrationState) {
    const { instrument, instructor, schedule } = state.selection;
    this.setText("review-instrument", instrument.title);
    this.setText("review-instructor", instructor.name);
    this.setText("review-schedule", this.formatSchedule(schedule));
    this.setText("review-student", `${state.student.firstName} ${state.student.lastName}`.trim());
    this.setText("review-nationalCode", state.student.nationalCode ? toPersianDigits(state.student.nationalCode) : null);
    this.setText("review-mobile", state.student.mobile ? formatMobileDisplay(state.student.mobile) : null);
    this.setText("review-age", state.student.age ? toPersianDigits(state.student.age) : null);
    this.setText("review-gender", this.translateGender(state.student.gender));
    this.setText("review-hasInstrument", this.translateInstrumentStatus(state.student.hasInstrument));
    this.renderPricing(instrument.slug);
  }

  private renderPricing(slug: string | null) {
    const container = document.querySelector<HTMLElement>("[data-review-pricing]");
    if (!container) return;
    const plan = getPricingPlan(slug);
    if (!plan) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = `<div class="pricing-card">
      <div class="pricing-head"><span>${escapeHtml(plan.title)}</span><strong>${toPersianDigits(plan.duration.sessions)} جلسه · ${escapeHtml(plan.duration.period)}</strong></div>
      <div class="pricing-options">${Object.values(plan.paymentOptions).map((option: any) => `<div class="pricing-option"><span>${escapeHtml(option.title)}</span><strong>${formatToman(option.amount)}</strong></div>`).join("")}</div>
    </div>`;
  }

  updateSuccess(state: RegistrationState) {
    const { instrument, instructor, schedule } = state.selection;
    this.setText("success-tracking-code", state.trackingCode);
    this.setText("success-instrument", instrument.title);
    this.setText("success-instructor", instructor.name);
    this.setText("success-schedule", this.formatSchedule(schedule));
    this.renderContactLinks();
    if (instrument.type) this.renderMaterials(instrument.type);
  }

  private renderMaterials(instrumentType: string) {
    const container = document.querySelector<HTMLElement>("[data-materials-container]");
    if (!container) return;
    const materials = getMaterialsByInstrument(instrumentType);
    const renderGroup = (title: string, items: any[], optional: boolean) => {
      if (!items.length) return "";
      return `<section class="materials-group"><h4>${title}</h4><div class="materials-grid">${items.map((item) => `<article class="material-card${optional ? " optional" : ""}">${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" />` : ""}<strong>${escapeHtml(item.title)}</strong>${optional ? `<span class="optional-tag">اختیاری</span>` : ""}</article>`).join("")}</div></section>`;
    };
    container.innerHTML = renderGroup("موارد ضروری", materials.required, false) + renderGroup("موارد اختیاری", materials.optional, true);
  }

  private renderContactLinks() {
    const container = document.querySelector<HTMLElement>("[data-contact-links]");
    if (!container) return;
    const telHref = `tel:+${contact.phones.mobile.raw}`;
    container.innerHTML = `<a href="${contact.social.whatsapp}" class="btn" target="_blank" rel="noopener">پیام واتساپ</a><a href="${telHref}" class="secondary-btn">تماس تلفنی</a>`;
  }

  private formatSchedule(schedule: RegistrationState["selection"]["schedule"]): string | null {
    if (!schedule?.weekday) return null;
    const parts = [schedule.weekday];
    if (schedule.sessionDuration) parts.push(`${toPersianDigits(schedule.sessionDuration)} دقیقه`);
    if (schedule.classroom) parts.push(`کلاس ${toPersianDigits(schedule.classroom)}`);
    return parts.join(" · ");
  }

  private translateGender(value: RegistrationState["student"]["gender"]): string {
    const map: Record<string, string> = { male: "آقا", female: "خانم" };
    return map[value ?? ""] ?? "-";
  }

  private translateInstrumentStatus(value: RegistrationState["student"]["hasInstrument"]): string {
    const map: Record<string, string> = { yes: "ساز دارم", no: "نیاز به مشاوره خرید ساز دارم" };
    return map[value ?? ""] ?? "-";
  }

  private setText(field: string, value: string | number | null | undefined) {
    const element = document.querySelector(`[data-field-out="${field}"]`);
    if (element) element.textContent = value ? String(value) : "-";
  }
}

export { RegistrationRenderer };
