import { getTranslations } from "next-intl/server";
import LoginButton from "./LoginButton";

export default async function LoginPage() {
  const t = await getTranslations("login");
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <h1 className="font-[family-name:var(--font-display)] font-semibold text-4xl uppercase tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <LoginButton />
      </div>
    </div>
  );
}
