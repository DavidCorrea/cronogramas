import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { schedules } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveGroupBySlug } from "@/lib/group";
import { buildPublicScheduleResponse } from "@/lib/public-schedule";
import SharedScheduleView from "@/components/SharedScheduleView";

export const revalidate = 300;

export default async function SharedSchedulePage({
  params,
}: {
  params: Promise<{ slug: string; year: string; month: string }>;
}) {
  const { slug, year: yearStr, month: monthStr } = await params;

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    notFound();
  }

  const group = await resolveGroupBySlug(slug);
  if (!group) {
    notFound();
  }

  const schedule = (
    await db
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.groupId, group.id),
          eq(schedules.month, month),
          eq(schedules.year, year),
          eq(schedules.status, "committed"),
        ),
      )
  )[0];

  if (!schedule) {
    const t = await getTranslations("cronograma");
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{t("agendaNotFound")}</h1>
          <p className="mt-2 text-muted-foreground">
            {t("noAgendaForMonth")}
          </p>
        </div>
      </div>
    );
  }

  const data = await buildPublicScheduleResponse({
    id: schedule.id,
    month: schedule.month,
    year: schedule.year,
    groupId: group.id,
  });

  return (
    <SharedScheduleView
      schedule={data}
      basePath={`/${slug}/cronograma`}
      slug={slug}
    />
  );
}
