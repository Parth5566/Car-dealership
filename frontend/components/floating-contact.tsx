"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Phone } from "lucide-react";
import { absoluteUrl } from "@/lib/site";
import styles from "./floating-contact.module.css";

// Floating contact shortcuts on every public page: call (bottom-left) and
// WhatsApp (bottom-right). Vehicle pages prefill the listing link in WhatsApp
// so the team knows which car the visitor is asking about, and on phones they
// swap the two circles for a fixed Call / WhatsApp / Test drive bar.
export function FloatingContact({
  whatsapp,
  call,
}: {
  whatsapp: string;
  call?: { display: string; href: string };
}) {
  const path = usePathname();
  // Phones reveal the buttons after the first screen so they never cover the
  // hero or a page's opening content; wider screens ignore this (see CSS).
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const update = () =>
      setRevealed(
        window.scrollY > 280 ||
          document.documentElement.scrollHeight < window.innerHeight * 1.3,
      );
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [path]);
  if (path.startsWith("/admin")) return null;
  const state = revealed ? "true" : "false";
  const listing = path.match(/^\/vehicles\/(\d+)\//);
  const canCall = !!call && /^tel:\+[1-9][0-9]{7,14}$/.test(call.href);
  const canChat = /^[1-9][0-9]{7,14}$/.test(whatsapp);
  const circle = listing ? ` ${styles.onListing}` : "";
  const text = path.startsWith("/vehicles/")
    ? `Hi NCR Wheelz, I'm interested in this vehicle: ${absoluteUrl(path)}`
    : "Hi NCR Wheelz, I'd like to know more about your vehicles.";
  return (
    <>
      {listing && (
        <nav
          className={styles.bar}
          aria-label="Contact us about this vehicle"
          data-action-bar
        >
          {canCall && (
            <a
              className={styles.barButton}
              href={call!.href}
              aria-label={`Call NCR Wheelz on ${call!.display}`}
            >
              <Phone size={19} aria-hidden="true" /> Call
            </a>
          )}
          {canChat && (
            <a
              className={`${styles.barButton} ${styles.barWhatsApp}`}
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat on WhatsApp about this vehicle (opens in a new tab)"
            >
              <WhatsAppIcon size={19} /> WhatsApp
            </a>
          )}
          <Link
            className={`${styles.barButton} ${styles.barPrimary}`}
            href={`/test-drive?vehicle=${listing[1]}`}
          >
            <CalendarDays size={19} aria-hidden="true" /> Test drive
          </Link>
        </nav>
      )}
      {canCall && (
        <a
          className={`${styles.button} ${styles.call}${circle}`}
          data-revealed={state}
          href={call!.href}
          aria-label={`Call NCR Wheelz on ${call!.display}`}
          title={`Call ${call!.display}`}
        >
          <Phone size={26} strokeWidth={2} aria-hidden="true" />
        </a>
      )}
      {canChat && (
        <WhatsAppLink
          number={whatsapp}
          text={text}
          revealed={state}
          extraClass={circle}
        />
      )}
    </>
  );
}
function WhatsAppLink({
  number,
  text,
  revealed,
  extraClass,
}: {
  number: string;
  text: string;
  revealed: string;
  extraClass: string;
}) {
  return (
    <a
      className={`${styles.button} ${styles.whatsapp}${extraClass}`}
      data-revealed={revealed}
      href={`https://wa.me/${number}?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with NCR Wheelz on WhatsApp (opens in a new tab)"
      title="Chat on WhatsApp"
    >
      <WhatsAppIcon size={30} />
    </a>
  );
}
function WhatsAppIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"
      />
    </svg>
  );
}
