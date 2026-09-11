"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { defaultRequirements, type Requirements } from "@/lib/domain";
export type User = {
  id: string;
  name: string;
  mode: "demo" | "real" | "test";
  role: "owner" | "renter" | null;
};
export async function api<T = Record<string, unknown>>(
  url: string,
  body?: unknown,
  method = body ? "POST" : "GET",
): Promise<T> {
  const res = await fetch(`/api/${url}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "ارتباط برقرار نشد.");
  return data;
}
type Context = {
  user: User | null;
  ready: boolean;
  aiConfigured: boolean;
  error: string;
  setError: (s: string) => void;
  setUser: (u: User | null) => void;
  requirements: Requirements;
  setRequirements: (r: Requirements) => void;
  compare: string[];
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  searchId: string | undefined;
  setSearchId: (s: string) => void;
  startDemo: () => Promise<User>;
};
const AppContext = createContext<Context | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [aiConfigured, setAi] = useState(false),
    [error, setError] = useState("");
  const [requirements, setRequirementsState] = useState<Requirements>(defaultRequirements),
    [compare, setCompare] = useState<string[]>([]),
    [searchId, setSearchIdState] = useState<string>();
  function setSearchId(id: string) {
    setSearchIdState(id);
    sessionStorage.setItem("tr_search_id", id);
  }
  const boot = useRef(false);
  function setRequirements(r: Requirements) {
    setRequirementsState(r);
    sessionStorage.setItem("tr_requirements", JSON.stringify(r));
  }
  function toggleCompare(id: string) {
    setCompare((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev;
      if (prev.length === 3 && !prev.includes(id)) setError("حداکثر سه آگهی را می‌توانید مقایسه کنید.");
      sessionStorage.setItem("tr_compare", JSON.stringify(next));
      return next;
    });
  }
  function clearCompare() {
    setCompare([]);
    sessionStorage.removeItem("tr_compare");
  }
  async function startDemo() {
    const res = await api<{ user: User }>("session", { action: "demo" });
    setUser(res.user);
    clearCompare();
    setSearchIdState(undefined);
    sessionStorage.removeItem("tr_search_id");
    return res.user;
  }
  useEffect(() => {
    if (boot.current) return;
    boot.current = true;
    try {
      const saved = sessionStorage.getItem("tr_requirements");
      if (saved) {
        const r = JSON.parse(saved);
        if (r.startDate >= defaultRequirements().startDate) setRequirementsState(r);
      }
      setCompare(JSON.parse(sessionStorage.getItem("tr_compare") || "[]"));
      const previousSearch = sessionStorage.getItem("tr_search_id");
      if (previousSearch) setSearchIdState(previousSearch);
    } catch {}
    api<{ user: User | null; aiConfigured: boolean }>("session")
      .then(async (r) => {
        setAi(r.aiConfigured);
        if (r.user) setUser(r.user);
        else {
          const d = await api<{ user: User }>("session", { action: "demo" });
          setUser(d.user);
          setCompare([]);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setReady(true));
  }, []);
  return (
    <AppContext.Provider
      value={{
        user,
        ready,
        aiConfigured,
        error,
        setError,
        setUser,
        requirements,
        setRequirements,
        compare,
        toggleCompare,
        clearCompare,
        searchId,
        setSearchId,
        startDemo,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("Missing provider");
  return ctx;
}
