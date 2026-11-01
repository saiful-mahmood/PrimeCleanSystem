import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { Document, Image as PdfImage, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatCents } from "@/lib/money";
import { hoursLabel, timeRange, type MonthlySchedule } from "./build";

const NAVY = "#1b2f4d";
const MUTED = "#4b5563";
const BORDER = "#c7cbd1";

// No lineHeight on the Page style (react-pdf drops render-prop Texts with one).
const s = StyleSheet.create({
  page: {
    paddingTop: 90,
    paddingBottom: 56,
    paddingHorizontal: 50,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1f2937",
  },
  header: { position: "absolute", top: 28, left: 50, right: 50 },
  logo: { width: 140, height: 42, objectFit: "contain" },
  rule: { marginTop: 6, borderBottomWidth: 1, borderBottomColor: "#9ca3af" },
  footerL: { position: "absolute", bottom: 26, left: 50, fontSize: 8, color: MUTED },
  footerC: { position: "absolute", bottom: 26, left: 0, right: 0, textAlign: "center", fontSize: 8, color: MUTED },
  footerR: { position: "absolute", bottom: 26, right: 50, fontSize: 8, color: MUTED },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: NAVY },
  sub: { marginTop: 3, color: MUTED, lineHeight: 1.3 },
  day: { marginTop: 12, marginBottom: 3, fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: BORDER, paddingVertical: 4 },
  time: { width: 110, lineHeight: 1.3 },
  main: { flex: 1, lineHeight: 1.3 },
  pay: { width: 60, textAlign: "right", lineHeight: 1.3 },
  small: { fontSize: 8.5, color: MUTED, lineHeight: 1.3 },
  off: { color: "#9ca3af", textDecoration: "line-through" },
});

let logoCache: Buffer | null = null;
function logo(): Buffer {
  if (!logoCache) logoCache = readFileSync(path.join(process.cwd(), "public", "logo.png"));
  return logoCache;
}

export function ScheduleDocument({ schedule, includePay }: { schedule: MonthlySchedule; includePay: boolean }) {
  return (
    <Document title={`${schedule.providerName} schedule ${schedule.monthLabel}`} author="Prime Clean Care">
      <Page size="LETTER" style={s.page}>
        <View style={s.header} fixed>
          <PdfImage style={s.logo} src={{ data: logo(), format: "png" }} />
          <View style={s.rule} />
        </View>
        <Text style={s.footerL} fixed>
          PRIME CLEAN CARE
        </Text>
        <Text style={s.footerC} render={({ pageNumber }) => `${pageNumber}`} fixed />
        <Text style={s.footerR} fixed>
          {schedule.providerName} · {schedule.monthLabel}
        </Text>

        <Text style={s.title}>
          {schedule.providerName} — {schedule.monthLabel}
        </Text>
        <Text style={s.sub}>
          {schedule.visitCount} visit{schedule.visitCount === 1 ? "" : "s"} · {hoursLabel(schedule.totalMinutes)}
          {includePay ? ` · ${formatCents(schedule.totalPayCents)}` : ""}
          {schedule.cancelledCount ? ` · ${schedule.cancelledCount} cancelled` : ""}
        </Text>

        {schedule.days.length === 0 && <Text style={{ marginTop: 16 }}>No visits this month.</Text>}
        {schedule.days.map((day) => (
          <View key={day.date} wrap={false}>
            <Text style={s.day}>{day.label}</Text>
            {day.visits.map((v) => {
              const off = v.status === "cancelled" || v.status === "skipped";
              return (
                <View key={v.jobId} style={s.row}>
                  <Text style={[s.time, ...(off ? [s.off] : [])]}>{timeRange(v)}</Text>
                  <View style={s.main}>
                    <Text style={off ? s.off : undefined}>
                      {v.clientName} · {v.serviceName}
                    </Text>
                    {v.address && <Text style={s.small}>{v.address}</Text>}
                    {v.accessNotes && <Text style={s.small}>Access: {v.accessNotes}</Text>}
                    {v.notes && <Text style={s.small}>Note: {v.notes}</Text>}
                    {off && <Text style={s.small}>Cancelled</Text>}
                  </View>
                  {includePay && <Text style={[s.pay, ...(off ? [s.off] : [])]}>{formatCents(v.payCents)}</Text>}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function renderSchedulePdf(schedule: MonthlySchedule, includePay: boolean): Promise<Buffer> {
  return renderToBuffer(<ScheduleDocument schedule={schedule} includePay={includePay} />);
}
