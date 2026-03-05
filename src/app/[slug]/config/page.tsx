"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useGroup } from "@/lib/group-context";
import LoadingScreen from "@/components/LoadingScreen";

export default function AdminHome() {
  const { slug, groupName, loading, error } = useGroup();
  const tConfig = useTranslations("configHome");
  const tNav = useTranslations("configNav");

  if (loading) return <LoadingScreen fullPage={false} />;
  if (error) return <p className="text-sm text-destructive">{tNav("groupNotFound")}</p>;

  const cards = [
    { href: `/${slug}/config/members`, label: tConfig("membersCard"), description: tConfig("membersDesc") },
    { href: `/${slug}/config/roles`, label: tConfig("rolesCard"), description: tConfig("rolesDesc") },
    { href: `/${slug}/config/events`, label: tConfig("eventsCard"), description: tConfig("eventsDesc") },
    { href: `/${slug}/config/holidays`, label: tConfig("holidaysCard"), description: tConfig("holidaysDesc") },
    { href: `/${slug}/config/collaborators`, label: tConfig("collaboratorsCard"), description: tConfig("collaboratorsDesc") },
    { href: `/${slug}/config/schedules`, label: tConfig("schedulesCard"), description: tConfig("schedulesDesc") },
    { href: `/${slug}/cronograma`, label: tConfig("publicViewCard"), description: tConfig("publicViewDesc") },
  ];

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-[family-name:var(--font-display)] font-semibold text-3xl sm:text-4xl uppercase">
          {groupName}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {tConfig("subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="card group block p-6 rounded-xl border border-border bg-card text-card-foreground hover:border-accent/50 hover:shadow-md transition-all duration-200"
          >
            <h2 className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
              {card.label}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {card.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
