"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { X, GitCompareArrows, Plus } from "lucide-react";
import { api } from "@/lib/api";
import type { Vehicle } from "@/lib/types";
import { parseCompareIds, toggleCompareId } from "@/lib/compare-state";
type Choice = Vehicle | { id: number; unavailable: true };
const Context = createContext<{
  ids: number[];
  items: Choice[];
  ready: boolean;
  loading: boolean;
  error: string;
  toggle: (id: number) => string;
  remove: (id: number) => void;
  clear: () => void;
  retry: () => void;
}>({
  ids: [],
  items: [],
  ready: false,
  loading: false,
  error: "",
  toggle: () => "",
  remove: () => {},
  clear: () => {},
  retry: () => {},
});
export const useComparison = () => useContext(Context);
export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<number[]>([]);
  const [items, setItems] = useState<Choice[]>([]);
  const [ready, setReady] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    try {
      setIds(parseCompareIds(localStorage.getItem("nw_compare")));
    } catch {}
    setReady(true);
    const sync = (e: StorageEvent) => {
      if (e.key === "nw_compare" || e.key === null)
        setIds(parseCompareIds(e.newValue));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    let active = true;
    if (!ready) return;
    setLoading(true);
    setError("");
    Promise.all(
      ids.map((id) =>
        api<Vehicle>("/vehicles/" + id).catch((e) => {
          if (active && e.status !== 404)
            setError(
              "Some vehicle details could not be loaded. Please try again.",
            );
          return { id, unavailable: true as const };
        }),
      ),
    ).then((result) => {
      if (active) {
        setItems(result);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [ids, ready, attempt]);
  function save(next: number[]) {
    setIds(next);
    try {
      localStorage.setItem("nw_compare", JSON.stringify(next));
    } catch {}
  }
  function toggle(id: number) {
    const next = toggleCompareId(ids, id);
    if (next === ids)
      return "You can compare up to 3 vehicles. Remove one to add another.";
    save(next);
    return next.includes(id)
      ? "Added to comparison"
      : "Removed from comparison";
  }
  return (
    <Context.Provider
      value={{
        ids,
        items,
        ready,
        loading,
        error,
        toggle,
        remove: (id) => save(ids.filter((i) => i !== id)),
        clear: () => save([]),
        retry: () => setAttempt((a) => a + 1),
      }}
    >
      {children}
      <CompareTray />
    </Context.Provider>
  );
}
function CompareTray() {
  const { ids, items, remove, clear, loading } = useComparison();
  const path = usePathname();
  const visible =
    path === "/" ||
    path === "/cars" ||
    path === "/commercial" ||
    path === "/saved" ||
    path.startsWith("/vehicles/");
  const shown = ids.length > 0 && visible;
  const tray = useRef<HTMLElement>(null);
  useEffect(() => {
    // Lets other fixed controls (the WhatsApp button) stay clear of the tray.
    const el = tray.current;
    if (!shown || !el || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const update = () =>
      root.style.setProperty(
        "--compare-tray-offset",
        `${el.offsetHeight + (parseFloat(getComputedStyle(el).bottom) || 0)}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--compare-tray-offset");
    };
  }, [shown]);
  if (!shown) return null;
  return (
    <>
      <div className="compare-tray-space" />
      <aside
        ref={tray}
        className="compare-tray"
        aria-label="Selected vehicles for comparison"
      >
        <div className="compare-tray-heading">
          <GitCompareArrows size={22} />
          <strong>
            Compare <span>{ids.length}/3</span>
          </strong>
          <button className="text-button" onClick={clear}>
            Clear
          </button>
        </div>
        <div className="compare-tray-choices">
          {ids.map((id, index) => {
            const item = items.find((v) => v.id === id);
            return (
              <div key={id}>
                <span>
                  {item && !item.unavailable
                    ? `${item.make} ${item.model}`
                    : loading
                      ? `Vehicle ${index + 1}…`
                      : "Unavailable listing"}
                </span>
                <button
                  className="icon-button"
                  aria-label={`Remove vehicle ${index + 1} from comparison`}
                  onClick={() => remove(id)}
                >
                  <X size={17} />
                </button>
              </div>
            );
          })}
          {ids.length < 3 && (
            <Link href="/compare">
              <Plus size={18} /> Add vehicle
            </Link>
          )}
        </div>
        {ids.length >= 2 ? (
          <Link className="btn gold" href="/compare">
            Compare now <GitCompareArrows size={19} />
          </Link>
        ) : (
          <span className="tray-hint">Choose one more to compare</span>
        )}
      </aside>
    </>
  );
}
