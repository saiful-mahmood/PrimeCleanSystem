"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Copies the plain-text schedule for pasting into a text message or WhatsApp. */
export function CopyTextButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <Button
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("copied");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 2500);
      }}
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Could not copy" : "Copy as text"}
    </Button>
  );
}
