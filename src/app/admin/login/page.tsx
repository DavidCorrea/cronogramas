"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function AdminLoginPage() {
  const router = useRouter();
  const t = useTranslations("admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t("authError"));
      setLoading(false);
      return;
    }

    // Redirect to admin panel
    router.push("/admin");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6 sm:space-y-8 text-center">
        <div>
          <h1 className="font-[family-name:var(--font-display)] font-semibold text-3xl sm:text-4xl uppercase tracking-tight text-foreground">
            {t("loginTitle")}
          </h1>
          <p className="mt-2 sm:mt-3 text-sm text-muted-foreground">
            {t("loginSubtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label htmlFor="admin-username" className="block text-sm text-muted-foreground mb-1.5">
              {t("username")}
            </label>
            <input
              id="admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-3 text-base sm:text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring min-h-[48px] sm:min-h-0 sm:py-2.5"
              placeholder={t("usernamePlaceholder")}
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-sm text-muted-foreground mb-1.5">
              {t("password")}
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-3 text-base sm:text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring min-h-[48px] sm:min-h-0 sm:py-2.5"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-5 py-3.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 min-h-[48px] sm:min-h-0 sm:py-2.5"
          >
            {loading ? t("verifying") : t("enter")}
          </button>
        </form>

        <p className="text-xs text-muted-foreground/50">
          {t("bootstrapNote")}
        </p>
      </div>
    </div>
  );
}
