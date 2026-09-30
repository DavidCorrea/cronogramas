import { redirect } from "next/navigation";

/**
 * Redirect to current month so there is a single URL shape for "view this month".
 * Bookmarks and links stay consistent at /[slug]/cronograma/[year]/[month].
 */
export default async function CronogramaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  redirect(`/${slug}/cronograma/${year}/${month}`);
}
