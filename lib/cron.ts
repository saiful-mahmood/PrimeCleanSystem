import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Cron routes accept `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron
 * sends when CRON_SECRET is set). Returns a 401 response to send, or null.
 */
export function authorizeCron(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
