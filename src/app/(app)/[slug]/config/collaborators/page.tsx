import { getGroupForConfigLayout } from "@/lib/config-server";
import { loadGroupCollaborators } from "@/lib/data-access";
import CollaboratorsClient from "./CollaboratorsClient";

export default async function CollaboratorsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = await getGroupForConfigLayout(slug);
  const data = await loadGroupCollaborators(group.id);

  return (
    <CollaboratorsClient
      slug={slug}
      groupId={group.id}
      initialData={data}
    />
  );
}
