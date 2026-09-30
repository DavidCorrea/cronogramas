import { getTranslations } from "next-intl/server";
import NewGroupForm from "./NewGroupForm";

export default async function NewGroupPage() {
  const t = await getTranslations("newGroup");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="font-[family-name:var(--font-display)] font-semibold text-3xl sm:text-4xl uppercase">
            {t("title")}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <NewGroupForm />
      </div>
    </div>
  );
}
