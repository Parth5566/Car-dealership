"use client";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type TouchEvent,
} from "react";
import { CarFront, ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { Vehicle } from "@/lib/types";
import { photoAlt } from "@/lib/photo-alt";
export function Gallery({
  images,
  vehicle,
}: {
  images: Vehicle["images"];
  vehicle?: Pick<Vehicle, "year" | "make" | "model" | "variant">;
}) {
  const [active, setActive] = useState(0);
  const alt = (text: string | undefined, index: number) =>
    vehicle
      ? photoAlt(text, vehicle, index, images.length)
      : text?.trim() || `Vehicle photo ${index + 1}`;
  const [expanded, setExpanded] = useState(false);
  const viewer = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!expanded || !viewer.current || !images.length) return;
    const dialog = viewer.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      opener.current?.focus();
    };
  }, [expanded, images.length]);

  function move(offset: number) {
    setActive((current) => (current + offset + images.length) % images.length);
  }
  // Horizontal swipes change the photo on touch screens.
  const touchStart = useRef<number | null>(null);
  const swipe = {
    onTouchStart(event: TouchEvent<HTMLElement>) {
      touchStart.current = event.touches[0]?.clientX ?? null;
    },
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      const start = touchStart.current;
      touchStart.current = null;
      const end = event.changedTouches[0]?.clientX;
      if (start === null || end === undefined || images.length < 2) return;
      if (Math.abs(end - start) > 40) move(end < start ? 1 : -1);
    },
  };
  function navigate(event: KeyboardEvent<HTMLElement>) {
    if (
      images.length < 2 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !["ArrowLeft", "ArrowRight"].includes(event.key)
    )
      return;
    event.preventDefault();
    move(event.key === "ArrowRight" ? 1 : -1);
  }
  function containFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey)
      return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "button:not([disabled])",
      ),
    );
    if (!buttons.length) return;
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      index < 0
        ? event.shiftKey
          ? buttons.length - 1
          : 0
        : (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
    buttons[next].focus();
  }
  if (!images.length)
    return (
      <div className="gallery-main no-image">
        <CarFront size={70} />
        <span>No photos available</span>
      </div>
    );
  const selected = active % images.length;
  const photo = images[selected];
  const multiple = images.length > 1;
  return (
    <section
      className="vehicle-gallery"
      aria-label="Vehicle photos"
      onKeyDown={navigate}
    >
      <div className="gallery-main" {...swipe}>
        <button
          ref={opener}
          type="button"
          className="gallery-open"
          aria-label={`Open photo ${selected + 1} in full-screen viewer`}
          aria-haspopup="dialog"
          onClick={() => {
            opener.current?.focus();
            setExpanded(true);
          }}
        >
          <img
            src={photo.url}
            alt={alt(photo.alt_text, selected)}
            fetchPriority="high"
            width={1000}
            height={666}
          />
          <span className="gallery-expand">
            <Expand size={16} aria-hidden="true" /> Full view
          </span>
        </button>
        {multiple && (
          <>
            <button
              type="button"
              className="gallery-nav gallery-previous"
              aria-label="Previous photo"
              onClick={() => move(-1)}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              className="gallery-nav gallery-next"
              aria-label="Next photo"
              onClick={() => move(1)}
            >
              <ChevronRight aria-hidden="true" />
            </button>
            <span
              className="gallery-count"
              aria-live={expanded ? "off" : "polite"}
            >
              {selected + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {multiple && (
        <div className="thumbnails" role="group" aria-label="Choose a photo">
          {images.map((i, index) => (
            <button
              key={i.id}
              type="button"
              className={selected === index ? "selected" : ""}
              aria-label={"Show photo " + (index + 1)}
              aria-pressed={selected === index}
              onClick={() => setActive(index)}
            >
              <img
                src={i.url + "?size=thumb"}
                alt={alt(i.alt_text, index)}
                loading="lazy"
                width={150}
                height={100}
              />
            </button>
          ))}
        </div>
      )}
      <dialog
        ref={viewer}
        className="photo-viewer"
        aria-label="Full-screen vehicle photos"
        onKeyDown={containFocus}
        onCancel={(event) => {
          event.preventDefault();
          setExpanded(false);
        }}
      >
        <div className="photo-viewer-header">
          <p aria-live="polite">
            Photo {selected + 1} of {images.length}
          </p>
          <button
            type="button"
            className="photo-viewer-close"
            aria-label="Close photo viewer"
            onClick={() => setExpanded(false)}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="photo-viewer-stage" {...swipe}>
          <img src={photo.url} alt={alt(photo.alt_text, selected)} />
        </div>
        {multiple && (
          <div className="photo-viewer-toolbar">
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Previous photo"
            >
              <ChevronLeft aria-hidden="true" /> Previous
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Next photo"
            >
              Next <ChevronRight aria-hidden="true" />
            </button>
          </div>
        )}
      </dialog>
    </section>
  );
}
