/*
====================================================
File: src/scripts/registration/RegistrationApi.ts

Purpose:
Registration communication layer.

Architecture:
- No UI logic, no DOM manipulation, no validation logic
- Mock implementation today; the shape is ready for a real
  backend endpoint later (see submit() below)
====================================================
*/

import type { RegistrationState } from "./RegistrationStore";

export interface RegistrationResponse {
  success: boolean;
  trackingCode?: string;
  message: string;
}

class RegistrationApi {
  async submit(state: RegistrationState): Promise<RegistrationResponse> {
    /*
    ==========================================
    Temporary mock API. Replace with:

    const res = await fetch("/api/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    });
    return res.json();
    ==========================================
    */

    console.log("Registration Data:", state);

    await this.delay(500);

    return {
      success: true,
      trackingCode: this.generateTrackingCode(),
      message: "ثبت نام با موفقیت انجام شد."
    };
  }

  private generateTrackingCode(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    return `FM-${year}-${random}`;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const registrationApi = new RegistrationApi();
