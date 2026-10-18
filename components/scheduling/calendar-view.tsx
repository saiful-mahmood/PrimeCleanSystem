"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type DragEvent } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { rescheduleJob, skipJob, markJobDone } from "@/app/(owner)/jobs/actions";
import { RecordPaymentForm } from "./job-actions";
import { formatCents } from "@/lib/money";
import { statusMeta, type AssignmentStatus, type JobStatus, ASSIGNMENT_LABEL } from "@/lib/scheduling/shared";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

export type CalendarJob = {
  id: string;
  seriesId: string | null;
  localDate: string;
  localTime: string;
  durationMin: number;
  status: JobStatus;
  chargeCents: number;
  receivedCents: number;
  chargeMethod: string | null;
  clientName: string;
  clientType: "residential" | "commercial";
  serviceName: string;
  city: string | null;
  notes: string | null;
  assignments: { id: string; status: AssignmentStatus; payCents: number; providerName: string }[];
};

const MOVABLE: JobStatus[] = ["scheduled", "confirmed", "in_progress"];

function time12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  return `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${ampm}`;
}

export function CalendarView({
  view,
  days,
  anchorMonth,
  today,
  jobs,
}: {
  view: "week" | "month";
  days: string[];
  anchorMonth: string;
  today: string;
  jobs: CalendarJob[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<CalendarJob | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const byDay = new Map<string, CalendarJob[]>();
  for (const j of jobs) byDay.set(j.localDate, [...(byDay.get(j.localDate) ?? []), j]);

  function onDrop(e: DragEvent, day: string) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/job-id");
    const job = jobs.find((j) => j.id === id);
    if (!job || job.localDate === day) return;
    setError(null);
    start(async () => {
      const r = await rescheduleJob(id, day);
      if (r.error) setError(r.error);
      router.refresh();
    });
  }

  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <>
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

      <div
        className={cn("grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border", pending && "opacity-60")}
      >
        {weekdayLabels.map((d) => (
          <div key={d} className="bg-muted px-2 py-1 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          const inMonth = view === "week" || day.startsWith(anchorMonth);
          return (
            <div
              key={day}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOver !== day) setDragOver(day);
              }}
              onDragLeave={() => setDragOver((d) => (d === day ? null : d))}
              onDrop={(e) => onDrop(e, day)}
              className={cn(
                "flex flex-col bg-background p-1",
                view === "week" ? "min-h-64" : "min-h-24",
                !inMonth && "bg-muted/40 text-muted-foreground",
                dragOver === day && "ring-2 ring-primary ring-inset",
              )}
            >
              <Link
                href={`/jobs/new?date=${day}`}
                className={cn(
                  "mb-1 self-start rounded px-1 text-xs hover:bg-accent",
                  day === today && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                )}
                title="New job on this day"
              >
                {view === "week" ? format(parseISO(day), "d MMM") : format(parseISO(day), "d")}
              </Link>
              <div className="flex flex-1 flex-col gap-1">
                {list.map((job) => (
                  <JobChip key={job.id} job={job} compact={view === "month"} onSelect={() => setSelected(job)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <JobPanel job={selected} onClose={() => setSelected(null)} today={today} />
    </>
  );
}

function JobChip({ job, compact, onSelect }: { job: CalendarJob; compact: boolean; onSelect: () => void }) {
  const meta = statusMeta(job.status);
  const movable = MOVABLE.includes(job.status);
  const who = job.assignments.map((a) => a.providerName).join(", ");
  return (
    <button
      type="button"
      draggable={movable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/job-id", job.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onSelect}
      className={cn(
        "w-full rounded border px-1.5 py-1 text-left text-xs leading-tight",
        meta.color,
        movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
      )}
      title={`${job.clientName} · ${job.serviceName}${who ? ` · ${who}` : ""}`}
    >
      <span className="font-medium">{time12(job.localTime)}</span> <span className="truncate">{job.clientName}</span>
      {!compact && (
        <div className="mt-0.5 truncate opacity-80">
          {job.serviceName}
          {who ? ` · ${who}` : " · unassigned"}
        </div>
      )}
    </button>
  );
}

function JobPanel({ job, onClose, today }: { job: CalendarJob | null; onClose: () => void; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const open = !!job;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {job && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {job.clientName}
                <StatusBadge status={job.status} />
              </SheetTitle>
              <SheetDescription>
                {format(parseISO(job.localDate), "EEEE, MMMM d")} · {time12(job.localTime)} · {job.durationMin} min
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 text-sm">
              <dl className="grid grid-cols-[6rem_1fr] gap-y-1.5">
                <dt className="text-muted-foreground">Service</dt>
                <dd>{job.serviceName}</dd>
                <dt className="text-muted-foreground">Where</dt>
                <dd>{job.city ?? "—"}</dd>
                <dt className="text-muted-foreground">Charge</dt>
                <dd>
                  {formatCents(job.chargeCents)}
                  {job.status !== "cancelled" && job.status !== "skipped" && (
                    <span
                      className={cn(
                        "ml-2 text-xs",
                        job.receivedCents >= job.chargeCents ? "text-emerald-700" : "text-amber-700",
                      )}
                    >
                      {job.receivedCents >= job.chargeCents
                        ? "paid"
                        : job.receivedCents > 0
                          ? `${formatCents(job.chargeCents - job.receivedCents)} still owed`
                          : "not paid yet"}
                    </span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Cleaner</dt>
                <dd>
                  {job.assignments.length === 0
                    ? "Unassigned"
                    : job.assignments.map((a) => (
                        <div key={a.id}>
                          {a.providerName} · {formatCents(a.payCents)} ·{" "}
                          <span className="text-muted-foreground">{ASSIGNMENT_LABEL[a.status]}</span>
                        </div>
                      ))}
                </dd>
                {job.notes && (
                  <>
                    <dt className="text-muted-foreground">Notes</dt>
                    <dd className="whitespace-pre-line">{job.notes}</dd>
                  </>
                )}
              </dl>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" nativeButton={false} render={<Link href={`/jobs/${job.id}`} />}>
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/jobs/${job.id}/edit`} />}
                >
                  Edit this one
                </Button>
                {MOVABLE.includes(job.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await markJobDone(job.id);
                        router.refresh();
                        onClose();
                      })
                    }
                  >
                    Mark done
                  </Button>
                )}
              </div>

              {job.status !== "cancelled" && job.status !== "skipped" && job.receivedCents < job.chargeCents && (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Client payment</p>
                  <RecordPaymentForm
                    jobId={job.id}
                    outstandingCents={job.chargeCents - job.receivedCents}
                    defaultMethod={job.chargeMethod}
                    today={today}
                    onRecorded={() => {
                      router.refresh();
                      onClose();
                    }}
                  />
                </div>
              )}

              {job.seriesId && (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Part of a recurring series</p>
                  <div className="flex flex-wrap gap-2">
                    {MOVABLE.includes(job.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            await skipJob(job.id);
                            router.refresh();
                            onClose();
                          })
                        }
                      >
                        Skip this one
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/series/${job.seriesId}/edit?from=${job.localDate}`} />}
                    >
                      Edit this and future
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      nativeButton={false}
                      render={<Link href={`/series/${job.seriesId}`} />}
                    >
                      View series
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
