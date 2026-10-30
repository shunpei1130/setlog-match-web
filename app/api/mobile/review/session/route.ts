import { NextResponse } from "next/server";
import { createReviewSession, isReviewDeployment } from "../../../../../lib/review";
import { LifecycleError } from "../../../../../lib/lifecycle";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isReviewDeployment(request)) return new Response("Not found", { status: 404 });
  const body = await request.json().catch(() => null);
  try { return NextResponse.json(await createReviewSession(body?.username, body?.password)); }
  catch (error) {
    if (error instanceof LifecycleError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "REVIEW_UNAVAILABLE" }, { status: 503 });
  }
}
