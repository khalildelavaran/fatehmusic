/*
====================================================
File: src/pages/api/contract-pdf.ts

Purpose:
Public contract-PDF endpoint for the registration wizard's own
Success step. Right after api/register.ts succeeds, the browser
has a trackingCode but no admin or student session (student portal
login is a separate, later step) -- so this endpoint's "auth" is
simply: the row's tracking_code must match the one supplied.

That's intentionally the same trust level the wizard already had:
the Success step was, until now, rendering this exact same data
straight from client-side state with no server check at all. A
tracking code is server-generated (api/register.ts), unique, and
only ever handed back to the person who just submitted that one
registration -- knowing it is proof enough for that one document,
the same way an order confirmation code works. It grants access to
nothing else.

For every other surface (admin panel, student portal) see
api/admin/contract-generate.ts, which is session-authenticated and
looks up by registration_id instead.

Both routes render through the same server/contracts/template.ts +
generate.ts pipeline, so the PDF is identical regardless of which
of the three places asked for it.
====================================================
*/

export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { loadRegistrationForContract, generateContractPdf } from "../../server/contracts/generate";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

export const POST: APIRoute = async ({ request }) => {
  const db = env.DB;
  const browser = (env as unknown as { BROWSER?: unknown }).BROWSER;
  if (!db) return json({ success: false, message: "دیتابیس در دسترس نیست." }, 503);
  if (!browser) return json({ success: false, message: "BROWSER binding تنظیم نشده است." }, 503);

  const body = (await request.json().catch(() => ({}))) as { tracking_code?: string };
  const trackingCode = (body.tracking_code ?? "").trim();
  if (!trackingCode) return json({ success: false, message: "کد پیگیری الزامی است." }, 422);

  let row;
  try {
    row = await loadRegistrationForContract(db, { trackingCode });
  } catch (e) {
    return json({ success: false, message: e instanceof Error ? e.message : String(e) }, Number((e as any)?.status) || 500);
  }

  try {
    return await generateContractPdf(db, browser, row);
  } catch (e) {
    return json({ success: false, message: `تولید PDF قرارداد شکست خورد: ${e instanceof Error ? e.message : String(e)}` }, Number((e as any)?.status) || 500);
  }
};
