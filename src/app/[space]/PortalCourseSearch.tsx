"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { Search, X } from "lucide-react";

type PortalCourseSearchContextValue = {
  query: string;
  setQuery: (query: string) => void;
};

const PortalCourseSearchContext =
  createContext<PortalCourseSearchContextValue | null>(null);

export function PortalCourseSearchProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);

  return (
    <PortalCourseSearchContext.Provider value={value}>
      {children}
    </PortalCourseSearchContext.Provider>
  );
}

export function usePortalCourseSearch() {
  const context = useContext(PortalCourseSearchContext);

  if (!context) {
    throw new Error(
      "usePortalCourseSearch must be used within PortalCourseSearchProvider",
    );
  }

  return context;
}

export function PortalCourseSearchInput() {
  const { query, setQuery } = usePortalCourseSearch();

  return (
    <div className="relative w-full max-w-sm">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        size={17}
      />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="搜索课程"
        placeholder="搜索课程标题或简介"
        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
      />
      {query && (
        <button
          type="button"
          aria-label="清空课程搜索"
          onClick={() => setQuery("")}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <X size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
