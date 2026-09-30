"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { OptionToggleGroup } from "@/components/OptionToggleGroup";
import { SkeletonRegion } from "@/components/Skeletons";
import { localTimeToUtc } from "@/lib/timezone-utils";
import { DAY_ORDER } from "@/lib/constants";

const AvailabilityWeekGrid = dynamic(
  () => import("@/components/AvailabilityWeekGrid"),
  {
    loading: () => (
      <SkeletonRegion className="h-[330px]">
        <div className="h-full animate-pulse rounded-lg bg-muted/30" />
      </SkeletonRegion>
    ),
  },
);

const AVAILABILITY_WEEKDAYS: {
  id: number;
  weekdayId: number;
  dayOfWeek: string;
}[] = DAY_ORDER.map((dayOfWeek, i) => ({
  id: i + 1,
  weekdayId: i + 1,
  dayOfWeek,
}));

interface Role {
  id: number;
  name: string;
  requiredCount: number;
}

interface NewMemberClientProps {
  slug: string;
  groupId: number;
  roles: Role[];
}

export default function NewMemberClient({
  slug,
  groupId,
  roles,
}: NewMemberClientProps) {
  const router = useRouter();
  const t = useTranslations("members");
  const tCommon = useTranslations("common");

  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [availabilityLocal, setAvailabilityLocal] = useState<
    Record<number, { startLocal: string; endLocal: string }[]>
  >({});
  const [formError, setFormError] = useState("");

  const toggleRole = (roleId: number) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!memberName.trim()) return;

    const availability = Object.entries(availabilityLocal).flatMap(
      ([weekdayId, blocks]) =>
        blocks.map(({ startLocal, endLocal }) => ({
          weekdayId: parseInt(weekdayId, 10),
          startTimeUtc: localTimeToUtc(startLocal),
          endTimeUtc: localTimeToUtc(endLocal),
        })),
    );

    const res = await fetch(`/api/members?groupId=${groupId}`, {
      method: "POST",
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

    router.push(`/${slug}/config/members`);
  };

  return (
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
            {t("emailLabel")}{" "}
            <span className="text-muted-foreground/50">
              {t("emailOptional")}
            </span>
          </label>
          <input
            type="email"
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
            placeholder={t("emailPlaceholder")}
          />
        </div>

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
            days={AVAILABILITY_WEEKDAYS}
            availability={availabilityLocal}
            onChange={setAvailabilityLocal}
            gridHeight={330}
          />
        </div>

        {formError && <p className="text-sm text-destructive">{formError}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={!memberName.trim()}
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("addMemberButton")}
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
  );
}
