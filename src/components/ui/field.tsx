"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* Form primitives in Oya tokens (SPEC §14.6, §14.10): 18px input radius, 44px+ targets, visible focus. */

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="font-bold text-forest">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-body">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-bold text-ember">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, invalid, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      aria-describedby={props.id ? (invalid ? `${props.id}-error` : `${props.id}-hint`) : undefined}
      className={cn(
        "mt-2 block min-h-12 w-full rounded-[18px] border-2 bg-paper px-4 py-3 text-forest transition-colors outline-none placeholder:text-muted focus:border-forest",
        invalid ? "border-ember" : "border-hairline",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Password input with an eye button to show or hide what's typed. The button is a real
 * toggle (aria-pressed) and keeps a 44px tap target inside the field.
 */
export function PasswordInput({
  className,
  invalid,
  showLabel,
  hideLabel,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { invalid?: boolean; showLabel: string; hideLabel: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} invalid={invalid} className={cn("pr-14", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? hideLabel : showLabel}
        title={visible ? hideLabel : showLabel}
        className="absolute right-1 bottom-0.5 grid size-11 place-items-center rounded-full text-body hover:text-forest"
      >
        {visible ? (
          <EyeOff aria-hidden="true" size={20} strokeWidth={2} />
        ) : (
          <Eye aria-hidden="true" size={20} strokeWidth={2} />
        )}
      </button>
    </div>
  );
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "mt-2 block min-h-12 w-full rounded-[18px] border-2 border-hairline bg-paper px-4 py-3 text-forest outline-none focus:border-forest",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Notice({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-ember/30 bg-peach text-forest",
    success: "border-deep-leaf/30 bg-mint text-forest",
    info: "border-hairline bg-sand text-forest",
  }[tone];
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-[18px] border px-4 py-3 text-[0.9375rem]", styles)}
    >
      {children}
    </p>
  );
}
