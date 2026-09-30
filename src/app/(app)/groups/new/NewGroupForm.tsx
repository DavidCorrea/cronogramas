"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

function generateSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function NewGroupForm() {
  const router = useRouter();
  const t = useTranslations("newGroup");

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
      setError(data.error || t("errorCreate"));
      setSubmitting(false);
      return;
    }

    const group = await res.json();
    router.push(`/${group.slug}/config`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section>
        <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-6">
          {t("groupInfo")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              {t("nameLabel")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
              placeholder={t("namePlaceholder")}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              {t("slugLabel")}
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground"
              placeholder={t("slugPlaceholder")}
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
          {submitting ? t("creating") : t("create")}
        </button>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}
