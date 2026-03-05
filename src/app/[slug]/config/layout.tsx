import { getGroupForConfigLayout } from "@/lib/config-server";
import { notFound } from "next/navigation";
import ConfigLayoutClient from "./ConfigLayoutClient";

/**
 * Config layout: resolve group on the server and pass group to the client.
 * Config data is loaded per-view via useConfigContext(slug, include) (view-scoped + TanStack Query).
 */
export default async function ConfigLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = await getGroupForConfigLayout(slug);
  if (!group) {
    notFound();
  }

  return (
    <ConfigLayoutClient initialGroup={group}>
      {children}
    </ConfigLayoutClient>
  );
}
