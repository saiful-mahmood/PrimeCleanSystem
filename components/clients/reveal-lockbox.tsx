"use client";

import { useEffect, useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { revealLockbox } from "@/app/(owner)/clients/actions";

const HIDE_AFTER_MS = 30_000;

export function RevealLockbox({ locationId }: { locationId: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!code) return;
    const t = setTimeout(() => setCode(null), HIDE_AFTER_MS);
    return () => clearTimeout(t);
  }, [code]);

  if (code) {
    return (
      <span className="inline-flex items-center gap-2">
        <code className="rounded bg-muted px-2 py-1 font-mono text-base tracking-widest">{code}</code>
        <Button variant="ghost" size="sm" onClick={() => setCode(null)} aria-label="Hide code">
          <EyeOff className="size-4" />
        </Button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await revealLockbox(locationId);
            if (result.error) setError(result.error);
            else setCode(result.code);
          })
        }
      >
        <Eye className="size-4" />
        {pending ? "Revealing…" : "Reveal"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
