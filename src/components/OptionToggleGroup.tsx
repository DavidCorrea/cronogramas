"use client";

/**
 * Reusable toggle group: a bordered set of buttons where each item can be selected/deselected.
 * Used for "active days", "rehearsal days" in configuration, and "roles" / "available days" in members form.
 */
export function OptionToggleGroup<T>({
  items,
  getKey,
  getLabel,
  isSelected,
  onToggle,
  title,
  description,
}: {
  items: T[];
  getKey: (item: T) => number | string;
  getLabel: (item: T) => string;
  isSelected: (item: T) => boolean;
  onToggle: (item: T) => void;
  title: string;
  description?: string;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="uppercase tracking-widest text-xs font-medium text-muted-foreground mb-2">
          {title}
        </h2>
        {description != null && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex flex-col lg:flex-row lg:flex-wrap gap-0 min-w-0 rounded-lg border border-border w-full lg:w-fit max-w-full">
        {items.map((item) => (
          <button
            key={getKey(item)}
            type="button"
            onClick={() => onToggle(item)}
            className={`w-full lg:w-auto rounded-none px-4 py-3 text-sm transition-colors text-left border-r border-b border-border first:border-l-0 last:border-r-0 last:border-b-0 lg:border-b-0 ${
              isSelected(item)
                ? "bg-primary/10 text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {getLabel(item)}
          </button>
        ))}
      </div>
    </section>
  );
}
