import { NextResponse } from "next/server";
import { getLiffId } from "../../../../lib/liff";

export const runtime = "nodejs";

// The LIFF ID is a public identifier (it is part of the LIFF URL), so the
// client can fetch it from here instead of bundling it at build time.
export async function GET() {
  return NextResponse.json({ liffId: getLiffId() });
}
