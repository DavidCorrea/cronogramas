"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function generateSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function NewGroupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(generateSlug(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !slug.trim()) return;
    setSubmitting(true);

    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        slug: slug.trim(),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al crear el grupo");
      setSubmitting(false);
      return;
    }

    const group = await res.json();
    router.push(`/${group.slug}/config`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl uppercase">
            Nuevo grupo
          </h1>
          <p className="mt-3 text-muted-foreground">
            Indica el nombre y la URL del grupo. El resto se configura después.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <section>
            <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-6">
              Información del grupo
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
                  placeholder="Nombre del grupo"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  Slug (URL) *
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
                  placeholder="slug-del-grupo"
                  required
                />
              </div>
            </div>
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={submitting || !name.trim() || !slug.trim()}
              className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Creando..." : "Crear grupo"}
            </button>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
