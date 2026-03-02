"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import SharedScheduleView, {
  SharedScheduleData,
} from "@/components/SharedScheduleView";
import LoadingScreen from "@/components/LoadingScreen";

export default function SharedSchedulePage() {
  const params = useParams();
  const slug = params.slug as string;
  const t = useTranslations("cronograma");
  const [schedule, setSchedule] = useState<SharedScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch(`/api/cronograma/${slug}/${params.year}/${params.month}`);
      if (!res.ok) {
        setError(true);
        setLoading(false);
        return;
      }
      setSchedule(await res.json());
    } catch {
      setError(true);
    }
    setLoading(false);
  }, [slug, params.year, params.month]);

  useEffect(() => {
    queueMicrotask(() => fetchSchedule());
  }, [fetchSchedule]);

  if (loading) {
    return <LoadingScreen fullPage />;
  }

  if (error || !schedule) {
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

  return <SharedScheduleView schedule={schedule} basePath={`/${slug}/cronograma`} />;
}
