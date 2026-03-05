"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useGroup } from "@/lib/group-context";
import { OptionToggleGroup } from "@/components/OptionToggleGroup";
import AvailabilityWeekGrid from "@/components/AvailabilityWeekGrid";
import { utcTimeToLocalDisplay, localTimeToUtc } from "@/lib/timezone-utils";
import { DAY_ORDER } from "@/lib/constants";
import LoadingScreen from "@/components/LoadingScreen";
import BackLink from "@/components/BackLink";
import { DangerZone } from "@/components/DangerZone";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/** Canonical 7 weekdays for availability grid (id/weekdayId 1–7 match DB weekdays table). */
const AVAILABILITY_WEEKDAYS: { id: number; weekdayId: number; dayOfWeek: string }[] = DAY_ORDER.map(
  (dayOfWeek, i) => ({ id: i + 1, weekdayId: i + 1, dayOfWeek })
);

interface Role {
  id: number;
  name: string;
  requiredCount: number;
}

interface WeekdayOption {
  id: number;
  weekdayId: number;
  dayOfWeek: string;
}

interface AvailabilitySlot {
  weekdayId: number;
  startTimeUtc: string;
  endTimeUtc: string;
}

interface Member {
  id: number;
  name: string;
  memberEmail: string | null;
  userId: string | null;
  roleIds: number[];
  availability: AvailabilitySlot[];
}

export default function EditMemberPage() {
  const params = useParams();
  const slug = params.slug as string;
  const id = params.id as string;
  const router = useRouter();
  const t = useTranslations("members");
  const tCommon = useTranslations("common");
  const { groupId, loading: groupLoading, refetchContext } = useGroup();
  const [member, setMember] = useState<Member | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [days, setDays] = useState<WeekdayOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  /** Per-weekday availability: key = weekdayId, value = array of blocks in local "HH:MM" */
  const [availabilityLocal, setAvailabilityLocal] = useState<Record<number, { startLocal: string; endLocal: string }[]>>({});
  const [formError, setFormError] = useState("");
  const [linkCheck, setLinkCheck] = useState<{ canLink: true; user: { id: string; name: string | null; email: string } } | { canLink: false } | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  const fetchData = useCallback(async () => {
    if (!groupId || !id) return;
    const memberId = parseInt(id, 10);
    if (Number.isNaN(memberId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const q = `?groupId=${groupId}`;
    const [memberRes, rolesRes] = await Promise.all([
      fetch(`/api/members/${memberId}`),
      fetch(`/api/configuration/roles${q}`),
    ]);
    if (!memberRes.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const memberData = await memberRes.json();
    setMember(memberData);
    setMemberName(memberData.name);
    setMemberEmail(memberData.memberEmail ?? "");
    setSelectedRoles([...memberData.roleIds]);
    const avail: Record<number, { startLocal: string; endLocal: string }[]> = {};
    for (const a of memberData.availability ?? []) {
      const wid = a.weekdayId;
      if (!avail[wid]) avail[wid] = [];
      avail[wid].push({
        startLocal: utcTimeToLocalDisplay(a.startTimeUtc ?? "00:00"),
        endLocal: utcTimeToLocalDisplay(a.endTimeUtc ?? "23:59"),
      });
    }
    setAvailabilityLocal(avail);
    setRoles(await rolesRes.json());
    setDays(AVAILABILITY_WEEKDAYS);
    setLoading(false);
  }, [groupId, id]);

  useEffect(() => {
    if (!member || !member.memberEmail?.trim() || member.userId) {
      setLinkCheck(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/members/${member.id}/link-check`);
      if (cancelled) return;
      const data = await res.json();
      if (data.canLink && data.user) {
        setLinkCheck({ canLink: true, user: data.user });
      } else {
        setLinkCheck({ canLink: false });
      }
    })();
    return () => { cancelled = true; };
  }, [member?.id, member?.memberEmail, member?.userId, member]);

  const handleLinkToUser = async () => {
    if (!linkCheck || !linkCheck.canLink || !("user" in linkCheck)) return;
    setLinkLoading(true);
    setFormError("");
    try {
      const res = await fetch(`/api/members/${member!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: linkCheck.user.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || t("errorLink"));
        return;
      }
      await fetchData();
    } finally {
      setLinkLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) fetchData();
  }, [groupId, fetchData]);

  const toggleRole = (roleId: number) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!memberName.trim()) return;

    const availability = Object.entries(availabilityLocal).flatMap(([weekdayId, blocks]) =>
      blocks.map(({ startLocal, endLocal }) => ({
        weekdayId: parseInt(weekdayId, 10),
        startTimeUtc: localTimeToUtc(startLocal),
        endTimeUtc: localTimeToUtc(endLocal),
      }))
    );

    const res = await fetch(`/api/members/${member!.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: memberName.trim(),
        email: memberEmail.trim() || null,
        roleIds: selectedRoles,
        availability,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setFormError(data.error || t("errorSave"));
      return;
    }

    await refetchContext();
    router.push(`/${slug}/config/members`);
  };

  const handleDelete = async () => {
    setConfirmDeleteOpen(true);
  };

  const performDelete = async () => {
    if (!member) return;
    setDeleteInProgress(true);
    try {
      const res = await fetch(`/api/members/${member.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || t("errorDelete"));
        setConfirmDeleteOpen(false);
        return;
      }
      await refetchContext();
      router.push(`/${slug}/config/members`);
    } finally {
      setDeleteInProgress(false);
    }
  };

  if (groupLoading || loading) {
    return <LoadingScreen fullPage={false} />;
  }

  if (notFound || !member) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{t("memberNotFound")}</p>
        <Link
          href={`/${slug}/config/members`}
          className="text-sm text-primary hover:underline"
        >
          {t("backToMembers")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div>
        <BackLink href={`/${slug}/config/members`} label={t("backToMembers")} />
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl uppercase">
          {t("editMemberTitle")}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {t("editMemberSubtitle")}
        </p>
      </div>

      <section className="border-t border-border pt-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="max-w-md">
            <label className="block text-sm text-muted-foreground mb-1.5">
              {t("nameLabel")}
            </label>
            <input
              type="text"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
              placeholder={t("namePlaceholder")}
              required
            />
          </div>

          <div className="max-w-md">
            <label className="block text-sm text-muted-foreground mb-1.5">
              {t("emailLabel")} <span className="text-muted-foreground/50">{t("emailOptional")}</span>
            </label>
            <input
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
              placeholder={t("emailPlaceholder")}
            />
          </div>

          {linkCheck?.canLink && "user" in linkCheck && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground mb-2">
                {t("linkAccountNote")}
              </p>
              <button
                type="button"
                onClick={handleLinkToUser}
                disabled={linkLoading}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:border-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {linkLoading ? t("linking") : t("linkWithGoogle")}
              </button>
            </div>
          )}

          <div>
            <OptionToggleGroup
              items={roles}
              getKey={(r) => r.id}
              getLabel={(r) => r.name}
              isSelected={(r) => selectedRoles.includes(r.id)}
              onToggle={(r) => toggleRole(r.id)}
              title={t("rolesTitle")}
            />
          </div>

          <div>
            <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-2">
              {t("daysAndTimes")}
            </h2>
            <AvailabilityWeekGrid
              days={days}
              availability={availabilityLocal}
              onChange={setAvailabilityLocal}
              gridHeight={330}
            />
          </div>

          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={!memberName.trim()}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("update")}
            </button>
            <Link
              href={`/${slug}/config/members`}
              className="rounded-md border border-border px-5 py-2.5 text-sm hover:border-foreground transition-colors inline-block"
            >
              {tCommon("cancel")}
            </Link>
          </div>
        </form>
      </section>

      <DangerZone>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-md border border-destructive/50 bg-destructive/10 px-5 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors"
        >
          {tCommon("delete")}
        </button>
      </DangerZone>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t("deleteMemberTitle")}
        message={t("confirmDelete")}
        confirmLabel={tCommon("delete")}
        onConfirm={performDelete}
        loading={deleteInProgress}
      />
    </div>
  );
}
