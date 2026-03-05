"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getRawArray } from "@/lib/intl-utils";
import { useHotkeys } from "react-hotkeys-hook";
import { useGroup } from "@/lib/group-context";
import { useConfigContext } from "@/lib/config-queries";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface GoToItem {
  id: string;
  label: string;
  href: string;
  type: "member" | "role" | "event" | "schedule";
}

export default function ConfigGoTo() {
  const { slug } = useGroup();
  const { members, roles, days, schedules } = useConfigContext(slug, [
    "members",
    "roles",
    "days",
    "schedules",
  ]);
  const router = useRouter();
  const tNav = useTranslations("configNav");
  const tSchedules = useTranslations("schedules");
  const monthNames = getRawArray(tSchedules, "months").length > 0 ? getRawArray(tSchedules, "months") : MONTH_NAMES;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useHotkeys("mod+k", () => {
    setOpen((prev) => {
      if (!prev) setQuery("");
      return !prev;
    });
  }, { enableOnFormTags: false, preventDefault: true });

  const items = useMemo<GoToItem[]>(() => {
    if (!slug) return [];
    const list: GoToItem[] = [];
    for (const m of members) {
      list.push({ id: `m-${m.id}`, label: m.name, href: `/${slug}/config/members/${m.id}`, type: "member" });
    }
    for (const r of roles) {
      list.push({ id: `r-${r.id}`, label: r.name, href: `/${slug}/config/roles/${r.id}`, type: "role" });
    }
    for (const d of days) {
      const label = (d.label || d.dayOfWeek || "Evento").trim();
      list.push({ id: `e-${d.id}`, label, href: `/${slug}/config/events/${d.id}`, type: "event" });
    }
    for (const s of schedules) {
      const label = `${monthNames[s.month - 1] ?? s.month} ${s.year}`;
      list.push({ id: `s-${s.id}`, label, href: `/${slug}/config/schedules/${s.id}`, type: "schedule" });
    }
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [slug, members, roles, days, schedules, monthNames]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 12);
    const q = query.toLowerCase().trim();
    return items.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 12);
  }, [items, query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          if (!open) setQuery("");
          setOpen(!open);
        }}
        className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
      >
        {tNav("goTo")}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tNav("goToPlaceholder")}
            className="w-full px-3 py-2.5 text-sm border-b border-border bg-transparent placeholder:text-muted-foreground focus:outline-none focus:border-accent"
          />
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {tNav("goToNoResults")}
              </li>
            ) : (
              filtered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item.href)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 rounded mx-1 transition-colors"
                  >
                    {item.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
