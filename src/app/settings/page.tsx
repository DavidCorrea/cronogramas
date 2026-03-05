"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatDateRangeWithYear } from "@/lib/timezone-utils";
import LoadingScreen from "@/components/LoadingScreen";
import { DangerZone } from "@/components/DangerZone";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Holiday {
  id: number;
  userId: string;
  startDate: string;
  endDate: string;
  description: string | null;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const t = useTranslations("settings");
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  // Holiday form state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [holidayIdToDelete, setHolidayIdToDelete] = useState<number | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  const fetchHolidays = useCallback(async () => {
    const res = await fetch("/api/holidays");
    if (res.ok) {
      setHolidays(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchHolidays());
  }, [fetchHolidays]);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!startDate || !endDate) {
      setError(t("datesRequired"));
      return;
    }

    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate,
        endDate,
        description: description.trim() || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t("errorCreateDate"));
      return;
    }

    setStartDate("");
    setEndDate("");
    setDescription("");
    fetchHolidays();
  };

  const handleDeleteHoliday = (id: number) => {
    setHolidayIdToDelete(id);
  };

  const performDeleteHoliday = async () => {
    if (holidayIdToDelete == null) return;
    setDeleteInProgress(true);
    try {
      await fetch(`/api/holidays?id=${holidayIdToDelete}`, { method: "DELETE" });
      fetchHolidays();
      setHolidayIdToDelete(null);
    } finally {
      setDeleteInProgress(false);
    }
  };

  const formatDateRange = (start: string, end: string) => formatDateRangeWithYear(start, end);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl uppercase">
            {t("title")}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        {/* Profile section */}
        {session?.user && (
          <div className="mb-12 border-t border-border pt-8">
            <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-6">
              {t("profile")}
            </h2>
            <div className="flex items-center gap-4">
              {session.user.image && (
                // eslint-disable-next-line @next/next/no-img-element -- small avatar from OAuth URL
                <img
                  src={session.user.image}
                  alt=""
                  className="h-12 w-12 rounded-full"
                />
              )}
              <div>
                <p className="font-medium">{session.user.name}</p>
                <p className="text-sm text-muted-foreground">{session.user.email}</p>
              </div>
            </div>
            {(session.user as { isAdmin?: boolean }).isAdmin && (
              <div className="mt-6">
                <Link
                  href="/admin"
                  className="rounded-md border border-border px-4 py-2 text-sm hover:border-foreground transition-colors"
                >
                  {t("adminPanel")}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Holidays section */}
        <div className="border-t border-border pt-8">
          <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-6">
            {t("absenceDates")}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {t("absenceDatesHelp")}
          </p>

          <form onSubmit={handleAddHoliday} className="space-y-4 mb-8">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  {t("from")}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  {t("until")}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  {t("description")}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
                  placeholder={t("optional")}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {t("add")}
            </button>
          </form>

          {loading ? (
            <LoadingScreen fullPage={false} />
          ) : holidays.length === 0 ? null : (
            <DangerZone>
              <div className="divide-y divide-border">
                {holidays.map((h) => (
                  <div key={h.id} className="py-4 first:pt-0 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {formatDateRange(h.startDate, h.endDate)}
                      </p>
                      {h.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {h.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteHoliday(h.id)}
                      className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-destructive hover:border-destructive transition-colors"
                    >
                      {t("delete")}
                    </button>
                  </div>
                ))}
              </div>
            </DangerZone>
          )}
        </div>

        <ConfirmDialog
          open={holidayIdToDelete != null}
          onOpenChange={(open) => !open && setHolidayIdToDelete(null)}
          title={t("absenceDates")}
          message={t("confirmDeleteHoliday")}
          confirmLabel={t("delete")}
          onConfirm={performDeleteHoliday}
          loading={deleteInProgress}
        />
      </div>
    </div>
  );
}
