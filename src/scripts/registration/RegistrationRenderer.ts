/*
====================================================
File: src/scripts/registration/RegistrationRenderer.ts

Purpose:
Everything that writes dynamic data into the DOM for the
Registration Wizard: instructor/schedule lists, the progress
stepper, the review summary, and the success screen.

Architecture:
- Pure DOM writer: reads RegistrationState (and the finished
  instructor/schedule lists the Controller already filtered)
  and updates the page
- No state management, no event binding, no filtering logic
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
  /* ==================================================
     Progress Stepper
  ================================================== */

  updateProgress(step: string) {
    const rail = document.querySelector<HTMLElement>("[data-progress]");
    if (!rail) return;

    const isWizardStep = (PROGRESS_STEPS as readonly string[]).includes(step);
    rail.hidden = !isWizardStep && step !== "success";

    const currentIndex =
      step === "success"
        ? PROGRESS_STEPS.length
        : PROGRESS_STEPS.indexOf(step as (typeof PROGRESS_STEPS)[number]);

    rail.querySelectorAll<HTMLElement>("[data-progress-step]").forEach((node) => {
      const nodeStep = node.dataset.progressStep as (typeof PROGRESS_STEPS)[number];
      const nodeIndex = PROGRESS_STEPS.indexOf(nodeStep);

      node.classList.remove("is-active", "is-complete");
      if (nodeIndex < currentIndex) node.classList.add("is-complete");
      else if (nodeIndex === currentIndex) node.classList.add("is-active");
    });
  }

  /* ==================================================
     Instructor List
  ================================================== */

  renderInstructors(list: InstructorRecord[]) {
    const container = document.querySelector<HTMLElement>("[data-instructors-container]");
    if (!container) return;

    if (!list.length) {
      container.innerHTML = this.emptyState("استادی برای این ساز در حال حاضر موجود نیست.");
      return;
    }

    container.innerHTML = list
      .map((instructor) => {
        const roles = instructor.professional?.roles ?? [];
        const image = instructor.media?.images?.profile;

        return `
          <article
            class="registration-card instructor-card"
            data-action="select-instructor"
            data-instructor-id="${instructor.id}"
            tabindex="0"
            role="button"
          >
            <div class="instructor-portrait">
              ${
                image
                  ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(instructor.name)}" loading="lazy" />`
                  : `<span class="portrait-fallback">${escapeHtml(instructor.name.charAt(0))}</span>`
              }
            </div>
            <div class="instructor-content">
              <h3>${escapeHtml(instructor.name)}</h3>
              ${
                roles.length
                  ? `<div class="tag-row">${roles
                      .map((role) => `<span class="mini-tag">${escapeHtml(role)}</span>`)
                      .join("")}</div>`
                  : ""
              }
              ${
                instructor.content?.excerpt
                  ? `<p class="instructor-excerpt">${escapeHtml(instructor.content.excerpt)}</p>`
                  : ""
              }
            </div>
            <div class="select-indicator">انتخاب استاد</div>
          </article>
        `;
      })
      .join("");
  }

  /* ==================================================
     Schedule List
  ================================================== */

  renderSchedules(list: ScheduleRecord[]) {
    const container = document.querySelector<HTMLElement>("[data-schedules-container]");
    if (!container) return;

    if (!list.length) {
      container.innerHTML = this.emptyState("در حال حاضر زمان آزادی برای این استاد ثبت نشده است.");
      return;
    }

    const sorted = sortByWeekday(list);

    container.innerHTML = sorted
      .map(
        (schedule) => `
          <article
            class="registration-card schedule-card"
            data-action="select-schedule"
            data-schedule-id="${schedule.id}"
            tabindex="0"
            role="button"
          >
            <div class="schedule-day">${escapeHtml(schedule.weekday)}</div>
            <ul class="schedule-meta">
              ${schedule.sessionDuration ? `<li>${toPersianDigits(schedule.sessionDuration)} دقیقه</li>` : ""}
              ${schedule.classroom ? `<li>کلاس ${toPersianDigits(schedule.classroom)}</li>` : ""}
              <li>${classModeLabel(schedule.classMode)}</li>
            </ul>
            <div class="select-indicator">انتخاب این زمان</div>
          </article>
        `
      )
      .join("");
  }

  private emptyState(message: string): string {
    return `<div class="registration-card empty-state"><p>${escapeHtml(message)}</p></div>`;
  }

  /* ==================================================
     Review Step
  ================================================== */

  updateReview(state: RegistrationState) {
    const { instrument, instructor, schedule } = state.selection;

    this.setText("review-instrument", instrument.title);
    this.setText("review-instructor", instructor.name);
    this.setText("review-schedule", this.formatSchedule(schedule));
    this.setText("review-student", `${state.student.firstName} ${state.student.lastName}`.trim());
    this.setText(
      "review-mobile",
      state.student.mobile ? formatMobileDisplay(state.student.mobile) : null
    );
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

    container.innerHTML = `
      <div class="pricing-card">
        <div class="pricing-head">
          <span>${escapeHtml(plan.title)}</span>
          <strong>${toPersianDigits(plan.duration.sessions)} جلسه · ${escapeHtml(plan.duration.period)}</strong>
        </div>
        <div class="pricing-options">
          ${Object.values(plan.paymentOptions)
            .map(
              (option: any) => `
                <div class="pricing-option">
                  <span>${escapeHtml(option.title)}</span>
                  <strong>${formatToman(option.amount)}</strong>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  /* ==================================================
     Success Step
  ================================================== */

  updateSuccess(state: RegistrationState) {
    const { instrument, instructor, schedule } = state.selection;

    this.setText("success-tracking-code", state.trackingCode);
    this.setText("success-instrument", instrument.title);
    this.setText("success-instructor", instructor.name);
    this.setText("success-schedule", this.formatSchedule(schedule));

    this.renderContactLinks();

    if (instrument.type) {
      this.renderMaterials(instrument.type);
    }
  }

  private renderMaterials(instrumentType: string) {
    const container = document.querySelector<HTMLElement>("[data-materials-container]");
    if (!container) return;

    const materials = getMaterialsByInstrument(instrumentType);

    const renderGroup = (title: string, items: any[], optional: boolean) => {
      if (!items.length) return "";
      return `
        <section class="materials-group">
          <h4>${title}</h4>
          <div class="materials-grid">
            ${items
              .map(
                (item) => `
                  <article class="material-card${optional ? " optional" : ""}">
                    ${
                      item.image
                        ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" />`
                        : ""
                    }
                    <strong>${escapeHtml(item.title)}</strong>
                    ${optional ? `<span class="optional-tag">اختیاری</span>` : ""}
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      `;
    };

    container.innerHTML =
      renderGroup("موارد ضروری", materials.required, false) +
      renderGroup("موارد اختیاری", materials.optional, true);
  }

  private renderContactLinks() {
    const container = document.querySelector<HTMLElement>("[data-contact-links]");
    if (!container) return;

    const telHref = `tel:+${contact.phones.mobile.raw}`;

    container.innerHTML = `
      <a href="${contact.social.whatsapp}" class="btn" target="_blank" rel="noopener">
        پیام واتساپ
      </a>
      <a href="${telHref}" class="secondary-btn">
        تماس تلفنی
      </a>
    `;
  }

  /* ==================================================
     Shared helpers
  ================================================== */

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
    const map: Record<string, string> = {
      yes: "ساز دارم",
      no: "نیاز به مشاوره خرید ساز دارم"
    };
    return map[value ?? ""] ?? "-";
  }

  private setText(field: string, value: string | number | null | undefined) {
    const element = document.querySelector(`[data-field-out="${field}"]`);
    if (element) element.textContent = value ? String(value) : "-";
  }
}

export { RegistrationRenderer };
