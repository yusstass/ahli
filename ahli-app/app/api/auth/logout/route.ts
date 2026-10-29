import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/session";
import { safeNext, sameOrigin } from "@/lib/security";
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await destroySession();
  return NextResponse.redirect(new URL(safeNext(req.nextUrl.searchParams.get("to") ?? undefined) ?? "/login", process.env.APP_URL!), 303);
}
