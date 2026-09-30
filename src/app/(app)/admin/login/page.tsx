import { getTranslations } from "next-intl/server";
import AdminLoginForm from "./AdminLoginForm";

export default async function AdminLoginPage() {
  const t = await getTranslations("admin");

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

        <AdminLoginForm />

        <p className="text-xs text-muted-foreground/50">
          {t("bootstrapNote")}
        </p>
      </div>
    </div>
  );
}
