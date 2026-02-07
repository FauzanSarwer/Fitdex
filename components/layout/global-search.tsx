"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Result = {
  type: string;
  label: string;
  subtitle?: string;
  href: string;
};

export function GlobalSearch({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const trimmed = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (!active) return;
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        if (!active) return;
        setResults([]);
        setOpen(true);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [trimmed]);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search gyms, users, memberships..."
        className="pl-9"
        onFocus={() => trimmed.length >= 2 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-2xl border border-white/10 bg-background/95 backdrop-blur shadow-glow-sm">
          <div className="max-h-72 overflow-auto p-2">
            {loading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No results found</div>
            ) : (
              results.map((item) => (
                <Link
                  key={`${item.type}-${item.href}`}
                  href={item.href}
                  className="flex flex-col gap-1 rounded-xl px-3 py-2 text-sm hover:bg-white/5"
                >
                  <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {item.type}
                  </span>
                  <span className="font-medium text-foreground">{item.label}</span>
                  {item.subtitle && (
                    <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
