"use client";

import { GroupProvider, type InitialGroupData, type ConfigContextData } from "@/lib/group-context";
import { UnsavedConfigProvider } from "@/lib/unsaved-config-context";
import ConfigLayoutInner from "./ConfigLayoutInner";

export default function ConfigLayoutClient({
  initialGroup,
  children,
}: {
  initialGroup: InitialGroupData;
  initialConfigContext?: ConfigContextData | null;
  children: React.ReactNode;
}) {
  return (
    <GroupProvider initialGroup={initialGroup}>
      <UnsavedConfigProvider>
        <ConfigLayoutInner />
        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          {children}
        </main>
      </UnsavedConfigProvider>
    </GroupProvider>
  );
}
