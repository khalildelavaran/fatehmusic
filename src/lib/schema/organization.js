import { site } from "@/data/site";

export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",

    name: site.name,
    url: site.url,
    logo: site.url + site.logo,

    telephone: site.telephone,

    email: site.email,

    sameAs: Object.values(site.socials).filter(Boolean)
  };
}