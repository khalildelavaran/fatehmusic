/*
====================================================
File: src/scripts/registration/RegistrationApi.ts

Purpose:
Registration communication layer. Sends the finished
registration to the server, which validates it again, stores it
in Cloudflare D1, and notifies academy staff.
See: src/pages/api/register.ts, src/server/notifications.ts
====================================================
*/

import type { RegistrationState } from "./RegistrationStore";

export interface RegistrationResponse {
  success: boolean;
  trackingCode?: string;
  term?: number;
  message: string;
}

interface RawApiResponse {
  success: boolean;
  trackingCode?: string;
  term?: number;
  message?: string;
  errors?: string[];
}

class RegistrationApi {
  async submit(state: RegistrationState): Promise<RegistrationResponse> {
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
      });

      const data = (await res.json()) as RawApiResponse;

      if (!res.ok || !data.success) {
        return {
          success: false,
          message: Array.isArray(data.errors) ? data.errors.join(" ") : "ثبت نام انجام نشد. لطفاً دوباره تلاش کنید."
        };
      }

      return {
        success: true,
        trackingCode: data.trackingCode,
        term: data.term,
        message: data.message ?? "ثبت نام با موفقیت انجام شد."
      };
    } catch (err) {
      console.error("Registration request failed:", err);
      return {
        success: false,
        message: "ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید."
      };
    }
  }
}

export const registrationApi = new RegistrationApi();
