import type { Settings } from "./types";
// Owner-supplied defaults remain in use until an admin explicitly saves public settings.
export const business = {
  name: "NCR Wheelz",
  phones: [
    { display: "99581 25967", href: "tel:+919958125967" },
    { display: "96502 01495", href: "tel:+919650201495" },
  ],
  email: "ncrwheelz@gmail.com",
  // wa.me format: country code + number, digits only.
  whatsapp: "919958125967",
  // Floating call button (bottom-left on every public page).
  callButton: { display: "96502 01495", href: "tel:+919650201495" },
  instagram: "https://www.instagram.com/ncrwheels2026",
  hours: "9:00 AM – 10:00 PM",
  address: "Tilak Nagar, New Delhi, India",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=NCR%20Wheelz%20Tilak%20Nagar%20New%20Delhi",
  mapEmbed:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3501.599384757887!2d77.0833171!3d28.6417666!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390d05eddd44b5a5%3A0x874509b298176a05!2sNCR%20Wheelz!5e0!3m2!1sen!2sin!4v1792351019300!5m2!1sen!2sin",
};
export function resolveBusiness(settings: Partial<Settings> = {}) {
  if (!settings.contact_customized)
    return {
      ...business,
      name: settings.business_name || business.name,
      whatsapp: settings.whatsapp || business.whatsapp,
    };
  const phones = [settings.phone || "", settings.phone_secondary || ""]
    .filter(Boolean)
    .map((display) => {
      const digits = display.replace(/\D/g, "");
      return {
        display,
        href: "tel:+" + (digits.length === 10 ? "91" : "") + digits,
      };
    });
  return {
    name: settings.business_name || business.name,
    phones,
    email: settings.email || "",
    address: settings.address || "",
    hours: settings.hours || "",
    whatsapp: settings.whatsapp || "",
    callButton: business.callButton,
    instagram: business.instagram,
    mapsUrl:
      settings.maps_url ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address || settings.business_name || business.name)}`,
    mapEmbed: settings.map_embed || "",
  };
}
