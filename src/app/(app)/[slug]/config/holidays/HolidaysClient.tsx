"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { formatDateRangeWithYear } from "@/lib/timezone-utils";
import { DangerZone } from "@/components/DangerZone";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface MemberOption {
  id: number;
  name: string;
}

interface HolidayEntry {
  id: number;
  memberId: number | null;
  userId: string | null;
  startDate: string;
  endDate: string;
  description: string | null;
  memberName: string;
  source: "member" | "user";
}

interface HolidaysClientProps {
  groupId: number;
  initialHolidays: HolidayEntry[];
  members: MemberOption[];
}

function formatDateRange(start: string, end: string): string {
  return formatDateRangeWithYear(start, end);
}

export default function HolidaysClient({
  groupId,
  initialHolidays,
  members,
}: HolidaysClientProps) {
  const router = useRouter();
  const t = useTranslations("holidays");
  const tCommon = useTranslations("common");
  const [holidays, setHolidays] = useState<HolidayEntry[]>(initialHolidays);

  const [memberId, setMemberId] = useState<number | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [holidayIdToDelete, setHolidayIdToDelete] = useState<number | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  const refreshData = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!memberId || !startDate || !endDate) {
      setError(t("allFieldsRequired"));
      return;
    }

    if (startDate > endDate) {
      setError(t("startBeforeEnd"));
      return;
    }

    const res = await fetch(`/api/configuration/holidays?groupId=${groupId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: Number(memberId),
        startDate,
        endDate,
        description: description.trim() || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t("errorCreate"));
      return;
    }

    setMemberId("");
    setStartDate("");
    setEndDate("");
    setDescription("");
    refreshData();
  };

  const handleDelete = (id: number) => {
    setHolidayIdToDelete(id);
  };

  const performDelete = async () => {
    if (holidayIdToDelete == null) return;
    const q = `?groupId=${groupId}`;
    setDeleteInProgress(true);
    try {
      await fetch(`/api/configuration/holidays/${holidayIdToDelete}${q}`, {
        method: "DELETE",
      });
      setHolidays((prev) => prev.filter((h) => h.id !== holidayIdToDelete));
      setHolidayIdToDelete(null);
      refreshData();
    } finally {
      setDeleteInProgress(false);
    }
  };

  const userHolidays = holidays.filter((h) => h.source === "user");
  const memberHolidays = holidays.filter((h) => h.source === "member");

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-[family-name:var(--font-display)] font-semibold text-3xl sm:text-4xl uppercase">
          {t("title")}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="border-t border-border pt-8 lg:grid lg:grid-cols-[1fr_2fr] lg:gap-12">
        {/* Add holiday form */}
        <div>
          <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-2">
            {t("addAbsence")}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t("addAbsenceHelp")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                {t("memberLabel")}
              </label>
              <select
                value={memberId}
                onChange={(e) =>
                  setMemberId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
                required
              >
                <option value="">{t("selectMember")}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                {tCommon("description")}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
                placeholder={tCommon("optional")}
              />
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  {tCommon("from")}
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
                  {tCommon("until")}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:border-foreground"
                  required
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              className="w-full rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {tCommon("add")}
            </button>
          </form>
        </div>

        {/* Holiday lists */}
        <div className="border-t border-border pt-8 mt-12 lg:border-t-0 lg:pt-0 lg:mt-0 space-y-10">
          {/* Group holidays (admin-set) */}
          <div>
            <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-2">
              {t("groupAbsences")}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {t("groupAbsencesHelp")}
            </p>

            {memberHolidays.length === 0 ? (
              <div className="border-t border-dashed border-border py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("noGroupAbsences")}
                </p>
              </div>
            ) : (
              <DangerZone description={t("dangerZoneDescription")}>
                <div className="divide-y divide-border">
                  {memberHolidays.map((h) => (
                    <div
                      key={h.id}
                      className="py-4 first:pt-0 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{h.memberName}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateRange(h.startDate, h.endDate)}
                        </p>
                        {h.description && (
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            {h.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(h.id)}
                        className="shrink-0 rounded-md border border-border px-3.5 py-2 text-sm text-destructive hover:border-destructive transition-colors"
                      >
                        {tCommon("delete")}
                      </button>
                    </div>
                  ))}
                </div>
              </DangerZone>
            )}
          </div>

          {/* User holidays (personal, read-only) */}
          {userHolidays.length > 0 && (
            <div className="border-t border-border pt-8">
              <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-2">
                {t("personalAbsences")}
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                {t("personalAbsencesHelp")}
              </p>

              <div className="divide-y divide-border">
                {userHolidays.map((h) => (
                  <div key={h.id} className="py-4 first:pt-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{h.memberName}</p>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t("personal")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDateRange(h.startDate, h.endDate)}
                    </p>
                    {h.description && (
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {h.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={holidayIdToDelete != null}
        onOpenChange={(open) => !open && setHolidayIdToDelete(null)}
        title={t("deleteHolidayTitle")}
        message={t("confirmDelete")}
        confirmLabel={tCommon("delete")}
        onConfirm={performDelete}
        loading={deleteInProgress}
      />
    </div>
  );
}
