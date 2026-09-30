import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getGroupForConfigLayout } from "@/lib/config-server";

export default async function AdminHome({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = await getGroupForConfigLayout(slug);
  const tConfig = await getTranslations("configHome");

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
          {group.name}
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
