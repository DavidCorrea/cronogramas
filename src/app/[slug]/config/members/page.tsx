"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useGroup } from "@/lib/group-context";
import LoadingScreen from "@/components/LoadingScreen";

interface Member {
  id: number;
  name: string;
  memberEmail: string | null;
  userId: string | null;
  email: string | null;
  image: string | null;
  userName: string | null;
  roleIds: number[];
  availableDayIds: number[];
}

export default function MembersPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { groupId, loading: groupLoading } = useGroup();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!groupId) return;
    const res = await fetch(`/api/members?groupId=${groupId}`);
    setMembers(await res.json());
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (groupId) queueMicrotask(() => fetchData());
  }, [groupId, fetchData]);

  if (groupLoading || loading) {
    return <LoadingScreen message="Cargando..." fullPage={false} />;
  }

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl uppercase">
          Miembros
        </h1>
        <p className="mt-3 text-muted-foreground">
          Agrega y gestiona los miembros del grupo. Asigna roles y configura disponibilidad.
        </p>
      </div>

      <section className="border-t border-border pt-8">
        <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-6">
          Miembros ({members.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href={`/${slug}/config/members/new`}
            className="rounded-lg border border-dashed border-border p-4 flex items-center justify-center h-20 text-sm font-medium text-muted-foreground hover:border-foreground hover:text-foreground transition-colors uppercase"
          >
            Agregar miembro
          </Link>
          {members.map((member) => (
            <Link
              key={member.id}
              href={`/${slug}/config/members/${member.id}`}
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
      </section>
    </div>
  );
}
