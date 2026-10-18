"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createPayoutDraft } from "@/app/(owner)/pay/actions";
import { formatCents } from "@/lib/money";

export type OwedAssignment = {
  id: string;
  payCents: number;
  status: "done" | "cancelled_paid" | "offered" | "accepted" | "declined" | "no_show";
  jobId: string;
  when: string;
  client: string;
  service: string;
};

export function PayoutBuilder({
  providerId,
  providerName,
  zelleHandle,
  items,
}: {
  providerId: string;
  providerName: string;
  zelleHandle: string | null;
  items: OwedAssignment[];
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((i) => i.id)));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const total = items.filter((i) => selected.has(i.id)).reduce((s, i) => s + i.payCents, 0);
  const all = selected.size === items.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <Link href={`/providers/${providerId}`} className="hover:underline">
            {providerName}
          </Link>
          <span className="tabular-nums">{formatCents(items.reduce((s, i) => s + i.payCents, 0))}</span>
        </CardTitle>
        <CardDescription>
          {items.length} unpaid job{items.length === 1 ? "" : "s"}
          {zelleHandle ? ` · Zelle ${zelleHandle}` : " · no Zelle handle on file"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={all}
            onChange={(e) => setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())}
            className="accent-primary"
          />
          Select all
        </label>
        <ul className="divide-y text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={selected.has(i.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(i.id);
                  else next.delete(i.id);
                  setSelected(next);
                }}
                className="accent-primary"
                aria-label={`Include ${i.client} on ${i.when}`}
              />
              <div className="min-w-0 flex-1">
                <Link href={`/jobs/${i.jobId}`} className="hover:underline">
                  {i.when}
                </Link>
                <div className="truncate text-muted-foreground">
                  {i.client} · {i.service}
                  {i.status === "cancelled_paid" && " · cancellation fee"}
                </div>
              </div>
              <span className="tabular-nums">{formatCents(i.payCents)}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm">
            Selected: <span className="font-semibold tabular-nums">{formatCents(total)}</span>
          </span>
          <Button
            disabled={pending || selected.size === 0}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await createPayoutDraft(providerId, [...selected]);
                if (r?.error) setError(r.error);
              })
            }
          >
            {pending ? "Creating…" : "Create payout"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
