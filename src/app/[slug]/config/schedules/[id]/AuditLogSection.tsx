"use client";

import type { AuditLogEntry } from "./schedule-detail-types";
import { tryParseJson, formatRelativeTime } from "./schedule-detail-helpers";

interface AuditLogSectionProps {
  entries: AuditLogEntry[];
  logOpen: boolean;
  logDetailOpen: number | null;
  onToggleLog: () => void;
  onToggleDetail: (id: number | null) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

export function AuditLogSection({
  entries,
  logOpen,
  logDetailOpen,
  onToggleLog,
  onToggleDetail,
  t,
}: AuditLogSectionProps) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        {t("noChangesRecorded")}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-md">
      <button
        onClick={onToggleLog}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{t("changeHistory")} ({entries.length})</span>
        <span className="text-xs">{logOpen ? "▲" : "▼"}</span>
      </button>
      {logOpen && (
        <div className="border-t border-border divide-y divide-border">
          {entries.map((entry) => {
            const parsed = tryParseJson(entry.detail);
            const isStructured = parsed && (parsed.changes || parsed.added);

            return (
              <div key={entry.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm">
                      {isStructured ? parsed.message : (entry.detail ?? entry.action)}
                    </p>
                    {entry.userName && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("byUser", { name: entry.userName })}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {formatRelativeTime(entry.createdAt, t)}
                  </span>
                </div>
                {isStructured && (
                  <div className="mt-1">
                    <button
                      onClick={() => onToggleDetail(logDetailOpen === entry.id ? null : entry.id)}
                      className="text-xs text-accent hover:opacity-80 transition-opacity"
                    >
                      {logDetailOpen === entry.id ? t("hideDetails") : t("showDetails")}
                    </button>
                    {logDetailOpen === entry.id && (
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {parsed.changes?.map((c, i) => (
                          <div key={`${c.date}-${c.role ?? ""}-${c.from ?? ""}-${c.to ?? ""}-${i}`} className="flex gap-2">
                            <span className="shrink-0">{c.date}</span>
                            <span className="shrink-0 uppercase tracking-wide">{c.role}</span>
                            <span>
                              {c.from ?? "—"} → {c.to ?? "—"}
                            </span>
                          </div>
                        ))}
                        {parsed.added && (
                          <>
                            {(parsed.removedCount ?? 0) > 0 && (
                              <p>{t("assignmentsReplaced", { n: parsed.removedCount ?? 0 })}</p>
                            )}
                            {parsed.added.map((a, i) => (
                              <div key={`${a.date}-${a.roleName}-${a.memberName}-${i}`} className="flex gap-2">
                                <span className="shrink-0">{a.date}</span>
                                <span className="shrink-0 uppercase tracking-wide">{a.roleName}</span>
                                <span>{a.memberName}</span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
