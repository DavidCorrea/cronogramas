"use client";

import { useMemo } from "react";

interface Role {
  id: number;
  name: string;
  requiredCount: number;
  displayOrder: number;
  dependsOnRoleId: number | null;
  exclusiveGroupId: number | null;
}

interface PriorityEditorProps {
  roles: Role[];
  orderedRoleIds: number[];
  onOrderChange: (ids: number[]) => void;
  onApply: () => void;
  reorderHelp: string;
  applyOrderLabel: string;
}

export function PriorityEditor({
  roles,
  orderedRoleIds,
  onOrderChange,
  onApply,
  reorderHelp,
  applyOrderLabel,
}: PriorityEditorProps) {
  const orderedRoles = useMemo(() => {
    const byId = new Map(roles.map((r) => [r.id, r]));
    return orderedRoleIds.map((id) => byId.get(id)).filter(Boolean) as Role[];
  }, [roles, orderedRoleIds]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...orderedRoleIds];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onOrderChange(next);
  };

  const moveDown = (index: number) => {
    if (index === orderedRoleIds.length - 1) return;
    const next = [...orderedRoleIds];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onOrderChange(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-2">
        {reorderHelp}
      </p>
      {orderedRoles.map((role, index) => (
        <div
          key={role.id}
          className="flex items-center gap-2 border-b border-border px-3.5 py-2 text-sm last:border-b-0"
        >
          <span className="text-muted-foreground w-6 text-right text-xs">
            {index + 1}.
          </span>
          <span className="flex-1">{role.name}</span>
          <button
            type="button"
            onClick={() => moveUp(index)}
            disabled={index === 0}
            className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => moveDown(index)}
            disabled={index === orderedRoles.length - 1}
            className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
          >
            ↓
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onApply}
        className="mt-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        {applyOrderLabel}
      </button>
    </div>
  );
}
