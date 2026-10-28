"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { api, send } from "@/lib/api";
import { User } from "@/lib/types";
import { ComparisonProvider } from "./comparison-provider";
const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  connectionError: string;
  reload: () => Promise<User | null>;
  logout: () => Promise<void>;
}>({
  user: null,
  loading: true,
  connectionError: "",
  reload: async () => null,
  logout: async () => {},
});
const SavedContext = createContext<{
  ids: number[];
  loaded: boolean;
  update: (id: number, on: boolean) => void;
}>({ ids: [], loaded: false, update: () => {} });
const ToastContext = createContext<(message: string) => void>(() => {});
export function Providers({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [toast, setToast] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const authGeneration = useRef(0);
  const [savedIds, setSavedIds] = useState<number[]>([]),
    [savedLoaded, setSavedLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    setSavedLoaded(false);
    if (!user) {
      setSavedIds([]);
      return;
    }
    api("/account/favourites")
      .then((r) => {
        if (active) {
          setSavedIds(r.items.map((i: { id: number }) => i.id));
          setSavedLoaded(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);
  const reload = useCallback(async () => {
    const version = ++authGeneration.current;
    setLoading(true);
    setConnectionError("");
    try {
      const current = (await api("/auth/me")).user as User;
      if (version === authGeneration.current) setUser(current);
      return current;
    } catch (error) {
      if ([401, 403].includes((error as { status?: number }).status || 0)) {
        if (version === authGeneration.current) setUser(null);
        return null;
      }
      if (version === authGeneration.current)
        setConnectionError(
          (error as Error).message ||
            "We couldn’t check your session. Please try again.",
        );
      throw error;
    } finally {
      if (version === authGeneration.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload().catch(() => {});
  }, [reload]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  const logout = async () => {
    await api("/auth/logout", send("POST"));
    ++authGeneration.current;
    setUser(null);
    setLoading(false);
    setConnectionError("");
    location.href = "/";
  };
  return (
    <AuthContext.Provider
      value={{ user, loading, connectionError, reload, logout }}
    >
      <ToastContext.Provider value={setToast}>
        <SavedContext.Provider
          value={{
            ids: savedIds,
            loaded: savedLoaded,
            update: (id, on) =>
              setSavedIds((ids) =>
                on ? [...new Set([...ids, id])] : ids.filter((i) => i !== id),
              ),
          }}
        >
          <ComparisonProvider>{children}</ComparisonProvider>
          {toast && (
            <div role="status" className="toast">
              {toast}
              <button
                onClick={() => setToast("")}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}
        </SavedContext.Provider>
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
export const useSaved = () => useContext(SavedContext);
export const useToast = () => useContext(ToastContext);
export function AuthGate({
  children,
  permission,
}: {
  children: ReactNode;
  permission?: string;
}) {
  const { user, loading, connectionError, reload } = useAuth();
  if (loading)
    return (
      <div className="container section">
        <div className="skeleton tall" />
      </div>
    );
  if (connectionError)
    return (
      <div className="container section">
        <div className="notice error" role="alert">
          <h1>Connection interrupted.</h1>
          <p>{connectionError}</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              void reload().catch(() => {});
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  if (!user)
    return (
      <div className="container section">
        <div className="empty">
          <h1>Make yourself at home.</h1>
          <p>Sign in to see your account and continue.</p>
          <a
            className="btn primary"
            href={
              "/login?next=" +
              encodeURIComponent(
                typeof location !== "undefined"
                  ? location.pathname
                  : "/account",
              )
            }
          >
            Sign in
          </a>
        </div>
      </div>
    );
  if (permission && !user.permissions.includes(permission))
    return (
      <div className="container section">
        <div className="notice error">
          Your account does not have access to this area.
        </div>
      </div>
    );
  return <>{children}</>;
}
