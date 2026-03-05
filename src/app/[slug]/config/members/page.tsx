"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useGroup } from "@/lib/group-context";
import { useConfigContext } from "@/lib/config-queries";
import LoadingScreen from "@/components/LoadingScreen";
import { EmptyState } from "@/components/EmptyState";

export default function MembersPage() {
  const params = useParams();
  const slug = params.slug as string;
  const t = useTranslations("members");
  const { slug: groupSlug } = useGroup();
  const { members, isLoading } = useConfigContext(slug ?? groupSlug ?? "", ["members"]);

  if (isLoading) {
    return <LoadingScreen fullPage={false} />;
  }

  const slugOrFallback = slug ?? groupSlug ?? "";

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

      <section className="border-t border-border pt-8">
        <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-6">
          {t("count", { n: members.length })}
        </h2>
        {members.length === 0 ? (
          <EmptyState
            message={t("emptyMessage")}
            ctaLabel={t("addMember")}
            ctaHref={`/${slugOrFallback}/config/members/new`}
          />
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href={`/${slugOrFallback}/config/members/new`}
            className="rounded-lg border border-dashed border-border p-4 flex items-center justify-center h-20 text-sm font-medium text-muted-foreground hover:border-foreground hover:text-foreground transition-colors uppercase"
          >
            {t("addMember")}
          </Link>
          {members.map((member) => (
            <Link
              key={member.id}
              href={`/${slugOrFallback}/config/members/${member.id}`}
              className="rounded-lg border border-border bg-card p-4 flex flex-col justify-center gap-3 h-20 hover:border-foreground transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {member.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small avatar from OAuth URL
                  <img
                    src={member.image}
                    alt=""
                    className="h-10 w-10 rounded-full shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted shrink-0 flex items-center justify-center text-lg text-muted-foreground">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-medium truncate">{member.name}</h3>
                  {member.memberEmail && (
                    <p className="text-xs text-muted-foreground truncate">
                      {member.memberEmail}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
        )}
      </section>
    </div>
  );
}
