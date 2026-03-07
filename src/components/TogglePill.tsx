"use client";

/**
 * Binary toggle styled as a pill — matches the theme toggle aesthetic
 * (rounded-full, border, primary accent on active side).
 */
export function TogglePill({
  checked,
  onChange,
  label,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
}) {
  const toggleId = id ?? `toggle-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <label htmlFor={toggleId} className={`flex items-center justify-between gap-3 py-1 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
      <span className="text-sm select-none">{label}</span>
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-border p-0.5 transition-colors disabled:cursor-not-allowed ${
          checked ? "bg-primary" : "bg-muted/50"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full transition-transform ${
            checked
              ? "translate-x-[calc(100%+2px)] bg-primary-foreground"
              : "translate-x-0 bg-muted-foreground/60"
          }`}
        />
      </button>
    </label>
  );
}
