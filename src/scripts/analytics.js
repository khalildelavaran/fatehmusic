/**
 * Fateh Music Academy
 * Analytics Events
 * Meta Pixel + Future Analytics integrations
 */

const trackMetaEvent = (eventName, params = {}) => {
  if (typeof window.fbq !== "function") return;

  window.fbq("track", eventName, params);
};


const initAnalytics = () => {

  if (window.__fatehAnalyticsInitialized) return;

  window.__fatehAnalyticsInitialized = true;


  /*
   * WhatsApp Lead
   */
  document.addEventListener("click", (event) => {

    const link = event.target.closest("a");

    if (!link) return;


    const href = link.getAttribute("href") || "";


    if (
      href.includes("wa.me") ||
      href.includes("whatsapp")
    ) {

      trackMetaEvent("Lead", {
        content_name: "WhatsApp Contact"
      });

    }


    /*
     * Phone Lead
     */
    if (href.startsWith("tel:")) {

      trackMetaEvent("Lead", {
        content_name: "Phone Call"
      });

    }

  });


};


initAnalytics();

document.addEventListener(
  "astro:page-load",
  initAnalytics
);
