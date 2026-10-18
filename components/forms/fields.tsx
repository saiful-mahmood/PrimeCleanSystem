"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Field({
  label,
  name,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-destructive" id={`${name}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = React.ComponentProps<typeof Input> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
};

export function TextField({ label, name, error, hint, wrapperClassName, ...props }: TextFieldProps) {
  return (
    <Field label={label} name={name} error={error} hint={hint} className={wrapperClassName}>
      <Input
        id={name}
        name={name}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
    </Field>
  );
}

type TextAreaFieldProps = React.ComponentProps<typeof Textarea> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
};

export function TextAreaField({ label, name, error, hint, wrapperClassName, ...props }: TextAreaFieldProps) {
  return (
    <Field label={label} name={name} error={error} hint={hint} className={wrapperClassName}>
      <Textarea id={name} name={name} aria-invalid={!!error} {...props} />
    </Field>
  );
}

export function SelectField({
  label,
  name,
  error,
  hint,
  options,
  defaultValue,
  wrapperClassName,
  allowEmpty,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  wrapperClassName?: string;
  allowEmpty?: string;
}) {
  return (
    <Field label={label} name={name} error={error} hint={hint} className={wrapperClassName}>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxField({
  label,
  name,
  defaultChecked,
  hint,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={name}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 size-4 accent-primary"
      />
      <div>
        <Label htmlFor={name}>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

export function FormActions({
  pending,
  submitLabel,
  error,
  cancelHref,
}: {
  pending: boolean;
  submitLabel: string;
  error?: string;
  cancelHref?: string;
}) {
  return (
    <div className="flex flex-col gap-3 pt-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {cancelHref && (
          <Button type="button" variant="ghost" nativeButton={false} render={<a href={cancelHref} />}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
